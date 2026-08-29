"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createUserAction,
  setUserActiveAction,
  updateUserRoleAction,
} from "@/app/admin/settings/actions";
import { confirmAppAction, useActionAlert } from "@/lib/sweetAlert";

const initialActionState = { status: "idle", message: "", errors: {}, submittedAt: 0 };

const fieldClassName =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100";

const roleOptions = [
  { value: "ADMIN", label: "Admin" },
  { value: "STAFF", label: "Staff" },
];

const roleLabels = { ADMIN: "Admin", STAFF: "Staff" };

function FormErrors({ errors }) {
  const messages = ["email", "password", "displayName", "role"].flatMap((field) => errors?.[field] ?? []);

  if (!messages.length) return null;

  return (
    <ul className="space-y-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
      {messages.map((message) => <li key={message}>• {message}</li>)}
    </ul>
  );
}

function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, initialActionState);
  const formReference = useRef(null);
  useActionAlert(state);

  useEffect(() => {
    if (state.status === "success") formReference.current?.reset();
  }, [state.status, state.submittedAt]);

  return (
    <form
      ref={formReference}
      action={formAction}
      noValidate
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="border-b border-slate-100 pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">New Account</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">เพิ่มบัญชีผู้ใช้งาน</h2>
        <p className="mt-1 text-sm text-slate-500">แจ้งอีเมลและรหัสผ่านเริ่มต้นให้ผู้ใช้งานแยกต่างหาก</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
          ชื่อผู้ใช้งาน
          <input className={fieldClassName} name="displayName" maxLength={160} required placeholder="ชื่อ-นามสกุล" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          อีเมล
          <input className={fieldClassName} name="email" type="email" required placeholder="name@example.com" />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          รหัสผ่านเริ่มต้น
          <input className={fieldClassName} name="password" type="password" minLength={8} required placeholder="อย่างน้อย 8 ตัวอักษร" />
        </label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
          บทบาท
          <select className={fieldClassName} name="role" defaultValue="STAFF">
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <FormErrors errors={state.errors} />
      <div className="flex justify-end border-t border-slate-100 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "กำลังสร้าง..." : "สร้างบัญชี"}
        </button>
      </div>
    </form>
  );
}

function RoleControl({ user, disabled }) {
  const [state, formAction, pending] = useActionState(updateUserRoleAction, initialActionState);
  useActionAlert(state);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={user.id} />
      <select
        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand"
        name="role"
        defaultValue={user.role}
        disabled={disabled}
      >
        {roleOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={disabled || pending}
        className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "..." : "บันทึก"}
      </button>
    </form>
  );
}

function ActiveToggle({ user, disabled }) {
  const [state, formAction, pending] = useActionState(setUserActiveAction, initialActionState);
  useActionAlert(state);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (user.isActive) {
      const confirmed = await confirmAppAction({
        title: "ระงับบัญชีผู้ใช้งาน",
        message: `ต้องการระงับการใช้งานของ "${user.displayName || user.email}" หรือไม่`,
        confirmButtonText: "ระงับบัญชี",
      });
      if (!confirmed) return;
    }
    form.requestSubmit();
  }

  return (
    <form action={formAction} onSubmit={handleSubmit}>
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="isActive" value={String(!user.isActive)} />
      <button
        type="submit"
        disabled={disabled || pending}
        className={`h-9 rounded-lg border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          user.isActive
            ? "border-rose-200 text-rose-600 hover:bg-rose-50"
            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        }`}
      >
        {pending ? "..." : user.isActive ? "ระงับบัญชี" : "เปิดใช้งาน"}
      </button>
    </form>
  );
}

function UserRow({ user, isSelf }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.role === "ADMIN" ? "bg-blue-50 text-brand" : "bg-slate-100 text-slate-600"}`}>
            {roleLabels[user.role]}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
            {user.isActive ? "ใช้งานได้" : "ถูกระงับ"}
          </span>
          {isSelf ? <span className="text-xs text-slate-400">(บัญชีของคุณ)</span> : null}
        </div>
        <p className="mt-2 truncate text-sm font-bold text-slate-900">{user.displayName || "—"}</p>
        <p className="truncate text-xs text-slate-500">{user.email}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <RoleControl user={user} disabled={isSelf} />
        <ActiveToggle user={user} disabled={isSelf} />
      </div>
    </div>
  );
}

export default function UserManager({ users, currentUserId }) {
  return (
    <div className="space-y-8">
      <CreateUserForm />
      <section aria-labelledby="user-list-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Account Registry</p>
            <h2 id="user-list-heading" className="mt-1 text-xl font-bold text-slate-900">รายชื่อผู้ใช้งาน</h2>
          </div>
          <span className="text-sm font-semibold text-slate-500">{users.length.toLocaleString("th-TH")} บัญชี</span>
        </div>
        {users.length ? (
          <div className="space-y-3">
            {users.map((user) => (
              <UserRow key={user.id} user={user} isSelf={user.id === currentUserId} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h2 className="font-bold text-slate-800">ยังไม่มีบัญชีผู้ใช้งาน</h2>
            <p className="mt-2 text-sm text-slate-500">สร้างบัญชีแรกจากแบบฟอร์มด้านบนได้เลย</p>
          </div>
        )}
      </section>
    </div>
  );
}
