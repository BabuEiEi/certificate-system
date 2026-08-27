begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

select ok(
  (select bool_and(relrowsecurity)
   from pg_class
   where oid in (
     'public.profiles'::regclass,
     'public.events'::regclass,
     'public.participants'::regclass,
     'public.signers'::regclass,
     'public.templates'::regclass,
     'public.certificate_settings'::regclass,
     'public.certificates'::regclass,
     'public.published_certificates'::regclass,
     'public.audit_logs'::regclass
   )),
  'RLS is enabled on every exposed table'
);

select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon cannot read profiles');
select ok(not has_table_privilege('anon', 'public.events', 'select'), 'anon cannot read events');
select ok(not has_table_privilege('anon', 'public.participants', 'select'), 'anon cannot read participants');
select ok(not has_table_privilege('anon', 'public.signers', 'select'), 'anon cannot read signers');
select ok(not has_table_privilege('anon', 'public.templates', 'select'), 'anon cannot read templates');
select ok(not has_table_privilege('anon', 'public.certificate_settings', 'select'), 'anon cannot read settings');
select ok(not has_table_privilege('anon', 'public.certificates', 'select'), 'anon cannot read internal certificates');
select ok(has_table_privilege('anon', 'public.published_certificates', 'select'), 'anon can read public certificate snapshots');
select ok(not has_table_privilege('anon', 'public.published_certificates', 'insert'), 'anon cannot insert public snapshots');
select ok(not has_table_privilege('anon', 'public.published_certificates', 'update'), 'anon cannot update public snapshots');
select ok(not has_table_privilege('anon', 'public.published_certificates', 'delete'), 'anon cannot delete public snapshots');
select ok(not has_table_privilege('authenticated', 'public.published_certificates', 'insert'), 'authenticated clients cannot insert public snapshots');
select ok(not has_table_privilege('authenticated', 'public.published_certificates', 'update'), 'authenticated clients cannot update public snapshots');
select ok(not has_table_privilege('authenticated', 'public.published_certificates', 'delete'), 'authenticated clients cannot delete public snapshots');
select ok(not has_table_privilege('anon', 'public.audit_logs', 'select'), 'anon cannot read audit logs');

select ok(has_function_privilege('authenticated', 'private.is_admin()', 'execute'), 'authenticated users can evaluate admin membership');
select ok(not has_function_privilege('anon', 'private.is_admin()', 'execute'), 'anon cannot execute admin membership checks');
select ok(not has_function_privilege('authenticated', 'private.handle_new_auth_user()', 'execute'), 'clients cannot invoke the auth trigger function');
select ok(not has_function_privilege('authenticated', 'private.sync_published_certificate()', 'execute'), 'clients cannot invoke the snapshot trigger function');

select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'events'),
  4,
  'events has one policy per mutation type'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'certificates'),
  4,
  'certificates has one policy per mutation type'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'published_certificates'),
  1,
  'public snapshots expose only one read policy'
);

select * from finish();
rollback;
