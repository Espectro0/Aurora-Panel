"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../lib/useTheme";
import { etiquetteClass } from "./Postal";

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`${etiquetteClass()} px-2`}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        {theme === "dark" ? (
          // sol: vuelve al día
          <>
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
          </>
        ) : (
          // luna: correo de noche
          <path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1Z" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

const NAV = [
  { label: "Home", href: "/" },
  { label: "Memory", href: "/mind" },
  { label: "Diary", href: "/journal" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="z-30 w-full shrink-0 bg-aero">
      <div className="par-avion h-2" aria-hidden="true" />
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2 text-ink no-underline">
          <span className="postal text-2xl font-extrabold tracking-[0.08em]">Aurora</span>
          <span className="text-sm text-ink-2">Panel</span>
        </Link>

        <div className="flex items-center gap-2">
          <nav aria-label="Main">
            <ul className="flex items-center gap-2">
              {NAV.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={etiquetteClass(active)}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </div>
      <div className="h-px bg-rule" aria-hidden="true" />
    </header>
  );
}
