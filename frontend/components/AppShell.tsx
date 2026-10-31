"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  Menu,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import Logo from "./Logo";
import { useStudent } from "@/lib/student";

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/discover", label: "Discover" },
  { href: "/changes", label: "Changes" },
  { href: "/eligibility", label: "Eligibility" },
  { href: "/research", label: "Research" },
  { href: "/ask", label: "Ask CampusIntel" },
];

function initials(name?: string | null) {
  if (!name) return "CI";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "CI";
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useStudent();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const isLanding = pathname === "/";
  const homeHref = isLanding ? "/" : "/overview";

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const onClick = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 border-b border-line/90 bg-paper/85 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-page items-center gap-4 px-5 sm:px-8">
            <Logo href={homeHref} />

            <nav className="ml-6 hidden items-center gap-0.5 lg:flex" aria-label="Primary">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`relative rounded-full px-3 py-2 text-[13px] transition-colors duration-200 ${
                    isActive(item.href) ? "font-medium text-ink" : "text-secondary hover:text-cobalt"
                  }`}
                >
                  {item.label}
                  {isActive(item.href) && (
                    <span className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-acid" aria-hidden="true" />
                  )}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-1.5">
              {isLanding ? (
                <Link href="/overview" className="btn-primary btn-sm hidden sm:inline-flex">
                  Open CampusIntel
                </Link>
              ) : null}

              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen((value) => !value)}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-2 transition-colors hover:bg-wash"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-mist text-[10.5px] font-semibold tracking-wide text-ink">
                    {initials(user?.name)}
                  </span>
                  <span className="hidden max-w-[120px] truncate text-[12.5px] font-medium text-ink sm:block">
                    {user?.name || "Your profile"}
                  </span>
                  <ChevronDown size={13} className="text-faint" />
                </button>

                {profileOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] w-64 animate-fade-up overflow-hidden rounded-2xl border border-line bg-paper p-1.5 shadow-[0_24px_60px_-30px_rgba(3,4,7,0.35)]"
                  >
                    <div className="px-3 py-2.5">
                      <p className="truncate text-[13px] font-medium text-ink">{user?.name || "No profile yet"}</p>
                      <p className="mt-0.5 truncate text-[11.5px] text-secondary">
                        {user?.institution || "Set your institution to personalise results"}
                      </p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <Link href="/profile" role="menuitem" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-ink hover:bg-mist">
                      <UserRound size={14} className="text-cobalt" /> Student profile
                    </Link>
                    <Link href="/profile#institution" role="menuitem" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-ink hover:bg-mist">
                      <Building2 size={14} className="text-cobalt" /> Institution settings
                    </Link>
                    <Link href="/profile#preferences" role="menuitem" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-ink hover:bg-mist">
                      <SlidersHorizontal size={14} className="text-cobalt" /> Preferences
                    </Link>
                  </div>
                )}
              </div>

              <button
                onClick={() => setMobileOpen((value) => !value)}
                className="rounded-full border border-line p-2 text-ink transition-colors hover:bg-wash lg:hidden"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X size={16} /> : <Menu size={16} />}
              </button>
            </div>
          </div>

          {mobileOpen && (
            <div className="animate-fade-in border-t border-line bg-paper px-5 py-3 lg:hidden">
              <nav className="flex flex-col" aria-label="Mobile">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3 py-2.5 text-[14px] ${
                      isActive(item.href) ? "bg-mist font-medium text-ink" : "text-secondary"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link href="/profile" className="rounded-xl px-3 py-2.5 text-[14px] text-secondary">
                  Student profile
                </Link>
              </nav>
            </div>
          )}
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-20 border-t border-line">
          <div className="mx-auto flex w-full max-w-page flex-col gap-4 px-5 py-8 text-[12px] text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium text-ink">CampusIntel</span>
              <span className="hidden sm:inline">Your academic world. One intelligence platform.</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <Link href="/research" className="hover:text-ink">
                Sources &amp; research
              </Link>
              <Link href="/profile" className="hover:text-ink">
                Profile
              </Link>
              <span className="text-faint">Official sources only · No invented notices</span>
            </div>
          </div>
        </footer>
    </div>
  );
}
