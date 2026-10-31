"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";

/* ------------------------------------------------------------------- layout */

export function Container({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-page px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-2 text-[30px] font-semibold leading-[1.15] tracking-tightest sm:text-[38px]">{title}</h1>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.015em]">{title}</h2>
        {description && <p className="mt-1 text-[13.5px] leading-relaxed text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ buttons */

type Variant = "primary" | "secondary" | "quiet";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  quiet: "btn-quiet",
};
const SIZE: Record<Size, string> = { sm: "btn-sm", md: "", lg: "btn-lg" };

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button className={`${VARIANT[variant]} ${SIZE[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className = "",
  children,
  external = false,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const classes = `${VARIANT[variant]} ${SIZE[size]} ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------- badges */

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "quiet" | "success" | "warning" | "danger" | "ink" | "lime" | "cobalt";
  className?: string;
}) {
  const map = {
    neutral: "chip",
    quiet: "chip-quiet",
    success: "chip-success",
    warning: "chip-warning",
    danger: "chip-danger",
    ink: "chip-ink",
    lime: "chip-lime",
    cobalt: "chip-cobalt",
  } as const;
  return <span className={`${map[tone]} ${className}`}>{children}</span>;
}

export function SourceLink({ url, label = "Official source" }: { url?: string | null; label?: string }) {
  if (!url) {
    return <span className="text-[12px] text-faint">Source link not recorded</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 text-[12px] font-medium text-cobalt transition-colors hover:text-cobalt/75"
    >
      {label}
      <ArrowUpRight size={12} />
    </a>
  );
}

/* --------------------------------------------------------------- empty/skel */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-card border border-dashed border-line px-6 py-14 text-center ${className}`}>
      {icon && <div className="mb-4 grid h-10 w-10 place-items-center rounded-full border border-line text-secondary">{icon}</div>}
      <p className="text-[14.5px] font-medium text-ink">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-secondary">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="mt-4 h-4 w-4/5" />
      <Skeleton className="mt-2.5 h-3 w-3/5" />
      <Skeleton className="mt-5 h-3 w-1/3" />
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#EEDCD9] bg-[#FBF3F2] px-4 py-3 text-[13px] text-danger">
      <span className="flex-1 leading-snug">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="rounded-full border border-[#EEDCD9] bg-paper px-3 py-1 text-[12px] font-medium text-danger">
          Try again
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- fields */

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">{hint}</p>}
    </div>
  );
}

export function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="text-[13px] text-secondary">{label}</span>
      <span className="max-w-[60%] text-right text-[13px] font-medium text-ink">{value || "Not specified"}</span>
    </div>
  );
}

/* -------------------------------------------------------------------- dialog */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 animate-fade-in bg-ink/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full animate-fade-up rounded-t-[24px] border border-line bg-paper p-6 shadow-[0_30px_80px_-30px_rgba(3,4,7,0.4)] sm:max-w-lg sm:rounded-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-[18px] font-semibold tracking-tight">
              {title}
            </h2>
            {description && <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-faint transition-colors hover:bg-mist hover:text-ink" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- disclosure */

export function Disclosure({
  summary,
  meta,
  children,
  defaultOpen = false,
}: {
  summary: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-wash"
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <span className="mt-0.5 shrink-0 text-faint">{open ? "−" : "+"}</span>
      </button>
      {meta && <div className="border-t border-line px-5 py-3">{meta}</div>}
      {open && <div className="animate-fade-in border-t border-line px-5 py-4">{children}</div>}
    </div>
  );
}
