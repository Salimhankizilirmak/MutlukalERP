"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  slug: string;
}

export default function DashboardNavClient({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <nav className="max-w-screen-2xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto scrollbar-none pb-0">
      {navItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.slug}
            href={item.href}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all duration-150 ${
              active
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
            }`}
          >
            <span className="text-sm leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
