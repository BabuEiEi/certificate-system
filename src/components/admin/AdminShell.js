"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { joinClassNames } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";

const navigation = [
  { href: "/admin/dashboard", label: "Dashboard", mark: "D", adminOnly: false },
  { href: "/admin/events", label: "กิจกรรม", mark: "ก", adminOnly: true },
  { href: "/admin/participants", label: "ผู้รับเกียรติบัตร", mark: "ผ", adminOnly: false },
  { href: "/admin/certificates", label: "เกียรติบัตร", mark: "C", adminOnly: false },
  { href: "/admin/signers", label: "ผู้ลงนาม", mark: "ล", adminOnly: true },
  { href: "/admin/templates", label: "แม่แบบ", mark: "ม", adminOnly: false },
  { href: "/admin/logs", label: "Logs", mark: "L", adminOnly: true },
  { href: "/admin/settings", label: "Settings", mark: "S", adminOnly: true },
];

export default function AdminShell({ children, user }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const visibleNavigation = navigation.filter((item) => !item.adminOnly || user.role === "ADMIN");

  return (
    <div className="min-h-screen bg-slate-100">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="ปิดเมนู"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={joinClassNames(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-brand-dark text-white shadow-2xl transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <Link href="/admin/dashboard" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1">
              <Image
                src="https://cdn.jsdelivr.net/gh/BabuEiEi/images/obec.png"
                alt="ตราสำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน"
                width={40}
                height={40}
                priority
                className="h-10 w-10 object-contain"
              />
            </span>
            <span>
              <span className="block text-sm font-bold">ระบบเกียรติบัตร</span>
              <span className="text-[10px] uppercase tracking-[0.16em] text-blue-200">Admin Console</span>
            </span>
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-blue-200 hover:bg-white/10 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="ปิดเมนู"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6" aria-label="เมนูผู้ดูแลระบบ">
          {visibleNavigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={joinClassNames(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-white font-semibold text-brand-dark shadow-sm"
                    : "text-blue-100 hover:bg-white/10 hover:text-white",
                )}
              >
                <span
                  className={joinClassNames(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    active ? "bg-blue-50 text-brand" : "bg-white/10 text-blue-100",
                  )}
                >
                  {item.mark}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <Link href="/" className="block rounded-xl px-4 py-3 text-xs text-blue-200 transition hover:bg-white/10 hover:text-white">
            ← กลับหน้าค้นหา
          </Link>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-5 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl text-slate-600 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="เปิดเมนู"
              aria-expanded={sidebarOpen}
            >
              ☰
            </button>
            <div className="min-w-0">
              <p className="hidden text-sm font-bold text-slate-800 sm:block">Certificate Management System</p>
              <p className="text-sm font-bold text-slate-800 sm:hidden">ระบบเกียรติบัตร</p>
              <p className="text-xs text-slate-400">ระบบจัดการเกียรติบัตร</p>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-44 truncate text-xs font-semibold text-slate-600">
                {user.displayName}
              </p>
              <p className="max-w-44 truncate text-[11px] text-slate-400">
                {user.email || user.role}
              </p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <span className="sm:hidden">ออก</span>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </form>
          </div>
        </header>
        <main className="p-5 sm:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
