create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.app_role as enum ('ADMIN', 'STAFF');
create type public.event_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');
create type public.certificate_status as enum ('DRAFT', 'PUBLISHED', 'REVOKED');
create type public.number_format as enum ('THAI', 'ARABIC');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 160),
  role public.app_role not null default 'STAFF',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 240),
  description text,
  starts_on date,
  ends_on date,
  issue_date date,
  issuer_name text not null default 'หน่วยงานผู้ออก' check (char_length(issuer_name) between 1 and 240),
  status public.event_status not null default 'DRAFT',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_date_range_check check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 240),
  email text,
  external_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, event_id)
);

create unique index participants_event_external_id_key
  on public.participants (event_id, external_id)
  where external_id is not null;

create table public.signers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 240),
  position text not null check (char_length(position) between 1 and 240),
  signature_path text not null,
  sort_order smallint not null check (sort_order between 1 and 3),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, sort_order)
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  storage_path text not null,
  width integer not null default 1600 check (width > 0),
  height integer not null default 1131 check (height > 0),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.certificate_settings (
  id smallint primary key default 1 check (id = 1),
  display_prefix text not null default 'เลขที่',
  prefix text not null default 'สทศ.',
  next_number bigint not null default 1 check (next_number > 0),
  number_digits smallint not null default 4 check (number_digits between 1 and 12),
  separator text not null default '/' check (char_length(separator) between 0 and 3),
  year integer not null,
  number_format public.number_format not null default 'THAI',
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  participant_id uuid not null,
  template_id uuid references public.templates (id) on delete set null,
  certificate_number text not null unique check (char_length(certificate_number) between 1 and 160),
  verification_token uuid not null default gen_random_uuid() unique,
  status public.certificate_status not null default 'DRAFT',
  file_path text,
  issued_at timestamptz not null default now(),
  published_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, participant_id),
  constraint certificates_participant_event_fk
    foreign key (participant_id, event_id)
    references public.participants (id, event_id)
    on delete restrict,
  constraint certificates_status_dates_check check (
    (status = 'DRAFT' and published_at is null and revoked_at is null)
    or (status = 'PUBLISHED' and published_at is not null and revoked_at is null)
    or (status = 'REVOKED' and published_at is not null and revoked_at is not null)
  )
);

-- Public snapshots deliberately contain no email, metadata, file path, or internal user IDs.
create table public.published_certificates (
  certificate_id uuid primary key references public.certificates (id) on delete cascade,
  certificate_number text not null unique,
  verification_token uuid not null unique,
  recipient_name text not null,
  event_name text not null,
  issuer_name text not null,
  issued_at timestamptz not null,
  status public.certificate_status not null check (status in ('PUBLISHED', 'REVOKED')),
  published_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid not null default auth.uid() references auth.users (id),
  action text not null check (char_length(action) between 1 and 120),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index events_status_idx on public.events (status);
create index participants_event_id_idx on public.participants (event_id);
create index signers_event_id_idx on public.signers (event_id);
create index certificates_event_id_idx on public.certificates (event_id);
create index certificates_participant_id_idx on public.certificates (participant_id);
create index certificates_status_idx on public.certificates (status);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index published_certificates_recipient_name_trgm_idx
  on public.published_certificates using gin (recipient_name extensions.gin_trgm_ops);
create index published_certificates_number_trgm_idx
  on public.published_certificates using gin (certificate_number extensions.gin_trgm_ops);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger events_set_updated_at before update on public.events
for each row execute function private.set_updated_at();
create trigger participants_set_updated_at before update on public.participants
for each row execute function private.set_updated_at();
create trigger signers_set_updated_at before update on public.signers
for each row execute function private.set_updated_at();
create trigger templates_set_updated_at before update on public.templates
for each row execute function private.set_updated_at();
create trigger certificate_settings_set_updated_at before update on public.certificate_settings
for each row execute function private.set_updated_at();
create trigger certificates_set_updated_at before update on public.certificates
for each row execute function private.set_updated_at();

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'ผู้ใช้งาน'
    )
  );
  return new;
end;
$$;

revoke execute on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'ADMIN'
        and is_active = true
    );
$$;

revoke execute on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

create function private.sync_published_certificate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('PUBLISHED', 'REVOKED') then
    insert into public.published_certificates (
      certificate_id,
      certificate_number,
      verification_token,
      recipient_name,
      event_name,
      issuer_name,
      issued_at,
      status,
      published_at,
      revoked_at,
      revoke_reason,
      updated_at
    )
    select
      new.id,
      new.certificate_number,
      new.verification_token,
      participant.full_name,
      event.name,
      event.issuer_name,
      new.issued_at,
      new.status,
      new.published_at,
      new.revoked_at,
      new.revoke_reason,
      now()
    from public.participants as participant
    join public.events as event on event.id = new.event_id
    where participant.id = new.participant_id
      and participant.event_id = new.event_id
    on conflict (certificate_id) do update set
      certificate_number = excluded.certificate_number,
      verification_token = excluded.verification_token,
      recipient_name = excluded.recipient_name,
      event_name = excluded.event_name,
      issuer_name = excluded.issuer_name,
      issued_at = excluded.issued_at,
      status = excluded.status,
      published_at = excluded.published_at,
      revoked_at = excluded.revoked_at,
      revoke_reason = excluded.revoke_reason,
      updated_at = excluded.updated_at;

    if not found then
      raise exception 'participant must belong to the certificate event';
    end if;
  else
    delete from public.published_certificates
    where certificate_id = new.id;
  end if;

  return new;
end;
$$;

revoke execute on function private.sync_published_certificate() from public, anon, authenticated;

create trigger certificates_sync_public_snapshot
after insert or update of status, certificate_number, verification_token, issued_at, participant_id, event_id
on public.certificates
for each row execute function private.sync_published_certificate();

insert into public.certificate_settings (year)
values ((extract(year from current_date)::integer + 543));

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.signers enable row level security;
alter table public.templates enable row level security;
alter table public.certificate_settings enable row level security;
alter table public.certificates enable row level security;
alter table public.published_certificates enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.participants from anon, authenticated;
revoke all on table public.signers from anon, authenticated;
revoke all on table public.templates from anon, authenticated;
revoke all on table public.certificate_settings from anon, authenticated;
revoke all on table public.certificates from anon, authenticated;
revoke all on table public.published_certificates from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.events to authenticated;
grant select, insert, update, delete on table public.participants to authenticated;
grant select, insert, update, delete on table public.signers to authenticated;
grant select, insert, update, delete on table public.templates to authenticated;
grant select, update on table public.certificate_settings to authenticated;
grant select, insert, update, delete on table public.certificates to authenticated;
grant select on table public.published_certificates to anon, authenticated;
grant select, insert on table public.audit_logs to authenticated;
grant usage, select on sequence public.audit_logs_id_seq to authenticated;

create policy "profiles_read_self"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_admin_read_all"
on public.profiles for select
to authenticated
using ((select private.is_admin()));

create policy "profiles_admin_update"
on public.profiles for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "events_admin_select" on public.events for select to authenticated
using ((select private.is_admin()));
create policy "events_admin_insert" on public.events for insert to authenticated
with check ((select private.is_admin()));
create policy "events_admin_update" on public.events for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "events_admin_delete" on public.events for delete to authenticated
using ((select private.is_admin()));

create policy "participants_admin_select" on public.participants for select to authenticated
using ((select private.is_admin()));
create policy "participants_admin_insert" on public.participants for insert to authenticated
with check ((select private.is_admin()));
create policy "participants_admin_update" on public.participants for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "participants_admin_delete" on public.participants for delete to authenticated
using ((select private.is_admin()));

create policy "signers_admin_select" on public.signers for select to authenticated
using ((select private.is_admin()));
create policy "signers_admin_insert" on public.signers for insert to authenticated
with check ((select private.is_admin()));
create policy "signers_admin_update" on public.signers for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "signers_admin_delete" on public.signers for delete to authenticated
using ((select private.is_admin()));

create policy "templates_admin_select" on public.templates for select to authenticated
using ((select private.is_admin()));
create policy "templates_admin_insert" on public.templates for insert to authenticated
with check ((select private.is_admin()));
create policy "templates_admin_update" on public.templates for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "templates_admin_delete" on public.templates for delete to authenticated
using ((select private.is_admin()));

create policy "certificate_settings_admin_select" on public.certificate_settings for select to authenticated
using ((select private.is_admin()));
create policy "certificate_settings_admin_update" on public.certificate_settings for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "certificates_admin_select" on public.certificates for select to authenticated
using ((select private.is_admin()));
create policy "certificates_admin_insert" on public.certificates for insert to authenticated
with check ((select private.is_admin()));
create policy "certificates_admin_update" on public.certificates for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "certificates_admin_delete" on public.certificates for delete to authenticated
using ((select private.is_admin()));

create policy "published_certificates_public_select"
on public.published_certificates for select
to anon, authenticated
using (true);

create policy "audit_logs_admin_select" on public.audit_logs for select to authenticated
using ((select private.is_admin()));
create policy "audit_logs_admin_insert" on public.audit_logs for insert to authenticated
with check ((select private.is_admin()) and actor_id = (select auth.uid()));
