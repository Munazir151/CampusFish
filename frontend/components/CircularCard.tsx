import { CalendarClock } from "lucide-react";
import { formatDate, formatInr, timeAgo } from "@/lib/api";
import {
  assessApplicability,
  assessQualification,
  deadlineState,
  normalise,
  APPLICABILITY_META,
  DEADLINE_META,
  QUALIFICATION_META,
} from "@/lib/student";
import { CATEGORY_META, CATEGORY_TONE, type Circular, type User } from "@/lib/types";
import { Badge, SourceLink } from "./ui";

export default function CircularCard({
  circular,
  user = null,
  showApplicability = true,
}: {
  circular: Circular;
  user?: User | null;
  showApplicability?: boolean;
}) {
  const category = CATEGORY_META[circular.category] ?? CATEGORY_META.HOLIDAY_OR_GENERAL;
  const assessment = assessApplicability(circular, user);
  const applicability = APPLICABILITY_META[assessment.status];
  const qualification = assessQualification(circular, user);
  const qualificationMeta = QUALIFICATION_META[qualification.status];
  const deadline = DEADLINE_META[deadlineState(circular.days_left)];
  const details = circular.details || {};
  const facts = [
    details.amount_value ? `Benefit ${formatInr(details.amount_value)}` : null,
    details.income_ceiling ? `Income up to ${formatInr(details.income_ceiling)}` : null,
    details.categories?.length ? details.categories.join(", ") : null,
    details.domicile ? `${details.domicile} domicile` : null,
    details.course_level || null,
  ].filter(Boolean);

  // "Unable to determine" on every notice is noise; it is explained on the Eligibility page.
  const showRelevance = showApplicability && assessment.status !== "UNKNOWN";
  const daysLeft = circular.days_left;
  const summaryAddsValue = circular.summary
    ? !normalise(circular.summary).includes(normalise(circular.title).slice(0, 40)) &&
      !normalise(circular.title).includes(normalise(circular.summary).slice(0, 40))
    : false;

  return (
    <article
      className={`card card-hover animate-fade-in p-5 sm:p-6 ${
        circular.urgency === "HIGH" ? "border-l-[3px] border-l-[#C0554A]" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={CATEGORY_TONE[circular.category] ?? "neutral"}>{category.label}</Badge>
        {showRelevance && <Badge tone={applicability.tone}>{applicability.label}</Badge>}
        {qualification.status !== "UNKNOWN" && (
          <Badge tone={qualificationMeta.tone}>{qualificationMeta.label}</Badge>
        )}
        {circular.deadline && <Badge tone={deadline.tone}>{deadline.label}</Badge>}
        <span className="ml-auto text-[11.5px] text-faint">{timeAgo(circular.detected_at)}</span>
      </div>

      <h3 className="mt-3 text-[16px] font-medium leading-[1.45] tracking-[-0.01em] text-ink">
        {circular.url ? (
          <a href={circular.url} target="_blank" rel="noreferrer noopener" className="hover:text-cobalt">
            {circular.title}
          </a>
        ) : (
          circular.title
        )}
      </h3>

      {summaryAddsValue && (
        <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-secondary">{circular.summary}</p>
      )}

      {facts.length > 0 && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-body">{facts.join(" · ")}</p>
      )}

      {circular.action_required && (
        <p className="mt-2.5 text-[13px] leading-relaxed text-body">
          <span className="font-medium text-ink">Next step:</span> {circular.action_required}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-[12px] text-secondary">
        <span className="font-medium text-body">{circular.source_name || circular.institution || "Official source"}</span>

        {circular.deadline && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock size={13} className="text-faint" />
            <span>
              {formatDate(circular.deadline)}
              {daysLeft !== null && daysLeft !== undefined && (
                <span className="text-faint">
                  {" "}
                  · {daysLeft < 0 ? "closed" : daysLeft === 0 ? "today" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`}
                </span>
              )}
            </span>
          </span>
        )}

        <div className="ml-auto">
          <SourceLink url={circular.url} />
        </div>
      </div>
    </article>
  );
}
