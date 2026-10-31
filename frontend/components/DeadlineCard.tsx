import { ArrowUpRight } from "lucide-react";
import { countdown, formatDate } from "@/lib/api";
import { deadlineState, DEADLINE_META } from "@/lib/student";
import { CATEGORY_META, type Circular } from "@/lib/types";
import { Badge } from "./ui";

export default function DeadlineRow({ circular }: { circular: Circular }) {
  const state = deadlineState(circular.days_left);
  const meta = DEADLINE_META[state];
  const category = CATEGORY_META[circular.category] ?? CATEGORY_META.HOLIDAY_OR_GENERAL;

  return (
    <li className="grid grid-cols-[76px_1fr] gap-4 border-b border-line py-4 last:border-0 sm:grid-cols-[104px_1fr_auto]">
      <div>
        <p className="text-[12.5px] font-medium text-ink">{formatDate(circular.deadline)}</p>
        <p className="mt-0.5 text-[11px] text-secondary">{countdown(circular.days_left)}</p>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="text-[11px] text-faint">{category.label}</span>
        </div>
        <p className="mt-1.5 text-[13.5px] font-medium leading-snug text-ink">
          {circular.url ? (
            <a href={circular.url} target="_blank" rel="noreferrer noopener" className="hover:text-cobalt">
              {circular.title}
            </a>
          ) : (
            circular.title
          )}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-secondary">
          {circular.source_name || circular.institution || "Issuing authority not stated"}
        </p>
      </div>

      <div className="col-span-2 flex items-center sm:col-span-1 sm:justify-end">
        {circular.url ? (
          <a
            href={circular.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-cobalt hover:text-cobalt/75"
          >
            Official notice <ArrowUpRight size={12} />
          </a>
        ) : (
          <span className="text-[11.5px] text-faint">No source link</span>
        )}
      </div>
    </li>
  );
}
