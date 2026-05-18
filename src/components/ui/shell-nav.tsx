"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/tasks", label: "我的任务" },
  { href: "/tasks/new", label: "新建任务" },
  { href: "/auth", label: "登录" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ShellNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
              active
                ? "border-[color:var(--border-strong)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)] shadow-[var(--shadow-sm)]"
                : "border-transparent text-[color:var(--muted)] hover:border-[color:var(--border)] hover:bg-white/55 hover:text-[color:var(--foreground)]",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
