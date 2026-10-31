import Link from "next/link";

export default function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="CampusFish home">
      <span className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-midnight text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 19V9.5L12 5l7 4.5V19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 19v-4.5h5V19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-acid" aria-hidden="true" />
      </span>
      {!compact && <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">CampusFish</span>}
    </Link>
  );
}
