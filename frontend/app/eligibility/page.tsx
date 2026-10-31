"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BadgeCheck, CircleHelp, FileText, Info, UserRound } from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  Badge,
  ButtonLink,
  CardSkeleton,
  Disclosure,
  EmptyState,
  ErrorNotice,
  FactRow,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { api, formatDate, formatDateTime, formatInr } from "@/lib/api";
import {
  APPLICABILITY_META,
  assessApplicability,
  assessQualification,
  deadlineState,
  DEADLINE_META,
  QUALIFICATION_META,
  useProfileExtras,
  useStudent,
  type ApplicabilityStatus,
  type Condition,
} from "@/lib/student";
import { CATEGORY_META, type Circular } from "@/lib/types";

const FILTERS: { key: ApplicabilityStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All assessments" },
  { key: "APPLIES", label: "Applies to you" },
  { key: "POTENTIALLY_APPLIES", label: "Potentially applies" },
  { key: "DOES_NOT_APPLY", label: "Does not apply" },
  { key: "UNKNOWN", label: "Unable to determine" },
];

function ConditionRow({ condition, state }: { condition: Condition; state: "match" | "mismatch" | "missing" }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <div>
        <p className="text-[12px] font-medium text-ink">{condition.label}</p>
        <p className="mt-0.5 text-[11px] text-secondary">Stated in notice: {condition.expected}</p>
      </div>
      <div className="text-right">
        <p className="text-[11.5px] text-secondary">{condition.actual}</p>
        <p
          className={`mt-0.5 text-[10px] uppercase tracking-[0.08em] ${
            state === "match" ? "text-success" : state === "missing" ? "text-warning" : "text-faint"
          }`}
        >
          {state === "match" ? "Matches" : state === "missing" ? "Missing" : "Does not match"}
        </p>
      </div>
    </div>
  );
}

export default function EligibilityPage() {
  const { user, loading: userLoading } = useStudent();
  const { extras } = useProfileExtras();

  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ApplicabilityStatus | "ALL">("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.circulars({ limit: 100 });
      setCirculars(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notices for assessment");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assessments = useMemo(
    () => circulars.map((circular) => ({ circular, assessment: assessApplicability(circular, user) })),
    [circulars, user],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: assessments.length };
    assessments.forEach(({ assessment }) => {
      map[assessment.status] = (map[assessment.status] || 0) + 1;
    });
    return map;
  }, [assessments]);

  const filtered = useMemo(
    () => assessments.filter(({ assessment }) => filter === "ALL" || assessment.status === filter),
    [assessments, filter],
  );

  const missingFields = useMemo(() => {
    if (!user) return ["Name", "Institution", "Branch", "Semester", "Scheme"];
    const missing: string[] = [];
    if (!user.institution) missing.push("Institution");
    if (!user.branch) missing.push("Branch");
    if (!user.semester) missing.push("Semester");
    if (!user.scheme) missing.push("Scheme");
    return missing;
  }, [user]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-page px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <PageHeader
          eyebrow="Eligibility intelligence"
          title="Understand what applies to you."
          description="CampusIntel evaluates the audience stated in each official notice against your profile. It distinguishes institutional applicability from individual qualification, and never declares eligibility while a mandatory condition is unknown."
          actions={
            <ButtonLink href="/profile" variant="secondary">
              <UserRound size={13} /> Edit profile
            </ButtonLink>
          }
        />

        {/* Concept distinction */}
        <section className="mt-8 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-3">
          {[
            {
              icon: BadgeCheck,
              title: "Institutional applicability",
              body: "Does the rule apply to your institution, programme, semester and scheme?",
            },
            {
              icon: CircleHelp,
              title: "Individual qualification",
              body: "Do you personally meet every stated condition, including income or category limits?",
            },
            {
              icon: FileText,
              title: "Eligibility",
              body: "Only claimed when both are established from the official document.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-paper p-5">
              <Icon size={16} className="text-ink" strokeWidth={1.6} />
              <p className="mt-3 text-[12.5px] font-medium text-ink">{title}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-secondary">{body}</p>
            </div>
          ))}
        </section>

        {error && (
          <div className="mt-6">
            <ErrorNotice message={error} onRetry={() => void load()} />
          </div>
        )}

        {!user && !userLoading && (
          <div className="mt-8">
            <EmptyState
              icon={<UserRound size={17} />}
              title="Add your academic profile to assess anything"
              description="Without an institution, branch, semester and scheme there is nothing to match against. CampusIntel will not guess your eligibility."
              action={
                <ButtonLink href="/profile" variant="primary">
                  Set up profile
                </ButtonLink>
              }
            />
          </div>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px] lg:gap-14">
          <div className="min-w-0">
            <SectionHeading
              title="Assessments"
              description={user ? "Based on the audience stated in each captured notice." : "Complete your profile to run assessments."}
            />

            <div className="mt-4 flex flex-wrap gap-1.5">
              {FILTERS.map((item) => {
                const active = filter === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setFilter(item.key)}
                    className={`chip rounded-full px-3 py-1.5 transition-colors ${
                      active ? "border-acid bg-acid text-midnight" : "hover:bg-mist"
                    }`}
                  >
                    {item.label}
                    <span className={active ? "text-midnight/55" : "text-faint"}>{counts[item.key] || 0}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 space-y-3">
              {loading
                ? Array.from({ length: 3 }).map((_, index) => <CardSkeleton key={index} />)
                : filtered.map(({ circular, assessment }) => {
                    const meta = APPLICABILITY_META[assessment.status];
                    const qualification = assessQualification(circular, user);
                    const qualificationMeta = QUALIFICATION_META[qualification.status];
                    const deadline = DEADLINE_META[deadlineState(circular.days_left)];
                    const details = circular.details || {};

                    return (
                      <Disclosure
                        key={circular.id}
                        summary={
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={meta.tone}>{meta.label}</Badge>
                              <span className="text-[11px] text-faint">{CATEGORY_META[circular.category]?.label}</span>
                              {qualification.status !== "UNKNOWN" && (
                                <Badge tone={qualificationMeta.tone}>{qualificationMeta.label}</Badge>
                              )}
                              {circular.deadline && <Badge tone={deadline.tone}>{deadline.label}</Badge>}
                            </div>
                            <p className="mt-2 text-[13.5px] font-medium leading-snug text-ink">{circular.title}</p>
                            <p className="mt-1 text-[11.5px] leading-relaxed text-secondary">{assessment.note}</p>
                          </div>
                        }
                        meta={
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-faint">
                            <span>{circular.source_name || circular.institution || "Authority not stated"}</span>
                            <span>Published {formatDate(circular.published_date)}</span>
                            <span>Deadline {formatDate(circular.deadline)}</span>
                          </div>
                        }
                      >
                        <div className="grid gap-6 lg:grid-cols-2">
                          <div>
                            <p className="eyebrow">Conditions stated in the notice</p>
                            <div className="mt-2">
                              {assessment.matched.map((condition) => (
                                <ConditionRow key={`m-${condition.label}`} condition={condition} state="match" />
                              ))}
                              {assessment.mismatched.map((condition) => (
                                <ConditionRow key={`x-${condition.label}`} condition={condition} state="mismatch" />
                              ))}
                              {assessment.missing.map((condition) => (
                                <ConditionRow key={`q-${condition.label}`} condition={condition} state="missing" />
                              ))}
                              {!assessment.matched.length &&
                                !assessment.mismatched.length &&
                                !assessment.missing.length && (
                                  <p className="rounded-xl bg-mist px-3 py-2.5 text-[11.5px] leading-relaxed text-secondary">
                                    The captured document does not state a structured audience, so no condition can be
                                    verified.
                                  </p>
                                )}
                            </div>

                            {assessment.missing.length > 0 && (
                              <div className="mt-4 rounded-xl border border-[#EFE4CB] bg-[#FBF7EE] p-3.5">
                                <p className="text-[11.5px] font-medium text-warning">Information needed from you</p>
                                <p className="mt-1 text-[11.5px] leading-relaxed text-secondary">
                                  {assessment.missing.map((condition) => condition.label).join(", ")}{" "}
                                  {assessment.missing.length === 1 ? "is" : "are"} missing from your profile. Add
                                  {assessment.missing.length === 1 ? " it" : " them"} in your student profile to move
                                  from potentially applying to a determination.
                                </p>
                                <ButtonLink href="/profile" variant="secondary" size="sm" className="mt-3">
                                  Complete profile
                                </ButtonLink>
                              </div>
                            )}

                            <div className="mt-4 rounded-xl border border-line p-3.5">
                              <p className="text-[11.5px] font-medium text-ink">Individual qualification</p>
                              <p className="mt-1 text-[11.5px] leading-relaxed text-secondary">{qualification.note}</p>

                              {details.amount_value || details.income_ceiling || details.domicile || details.course_level ? (
                                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[11px]">
                                  {details.amount_value && (
                                    <span className="text-secondary">Benefit: <span className="font-medium text-ink">{formatInr(details.amount_value)}</span></span>
                                  )}
                                  {details.income_ceiling && (
                                    <span className="text-secondary">Income limit: <span className="font-medium text-ink">{formatInr(details.income_ceiling)}</span></span>
                                  )}
                                  {details.domicile && (
                                    <span className="text-secondary">Domicile: <span className="font-medium text-ink">{details.domicile}</span></span>
                                  )}
                                  {details.course_level && (
                                    <span className="text-secondary">Level: <span className="font-medium text-ink">{details.course_level}</span></span>
                                  )}
                                </div>
                              ) : null}

                              {qualification.conditions.map((condition) => (
                                <ConditionRow
                                  key={`q-${condition.label}`}
                                  condition={condition}
                                  state={condition.state}
                                />
                              ))}

                              {details.eligibility_notes && (
                                <p className="mt-3 text-[10.5px] leading-relaxed text-faint">
                                  From the notice: {details.eligibility_notes}
                                </p>
                              )}

                              {!qualification.conditions.length && (
                                <p className="mt-2 text-[11px] leading-relaxed text-faint">
                                  No income, category or domicile condition was extracted from this document. Verify
                                  individual eligibility on the official notice.
                                </p>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="eyebrow">Profile used for this assessment</p>
                            <div className="mt-2">
                              <FactRow label="Institution" value={user?.institution} />
                              <FactRow label="Programme" value={extras.programme} />
                              <FactRow label="Branch" value={user?.branch} />
                              <FactRow label="Semester" value={user?.semester} />
                              <FactRow label="Scheme" value={user?.scheme} />
                              <FactRow label="Annual income" value={user?.annual_income ? formatInr(user.annual_income) : null} />
                              <FactRow label="Social category" value={user?.social_category} />
                              <FactRow label="Domicile" value={user?.domicile} />
                              <FactRow label="Institution type" value={extras.institutionType} />
                            </div>
                            <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
                              Audience matching uses branch, semester and scheme. Institution, programme and type are
                              shown for context only.
                            </p>

                            <p className="eyebrow mt-5">Dates</p>
                            <div className="mt-2">
                              <FactRow label="Published" value={formatDate(circular.published_date)} />
                              <FactRow label="Discovered" value={formatDateTime(circular.detected_at)} />
                              <FactRow label="Effective date" value="Not specified" />
                              <FactRow label="Application deadline" value={formatDate(circular.deadline)} />
                            </div>

                            <p className="eyebrow mt-5">Evidence</p>
                            <div className="mt-2 rounded-xl bg-wash p-3.5">
                              <p className="text-[11.5px] leading-relaxed text-secondary">
                                {circular.url
                                  ? "The official document below is the only evidence used. No model-generated assumption is treated as evidence."
                                  : "No source URL was recorded for this notice, so it cannot be verified against the original document."}
                              </p>
                              {circular.url && (
                                <a
                                  href={circular.url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-cobalt hover:text-cobalt/75"
                                >
                                  Open original document <ArrowUpRight size={12} />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </Disclosure>
                    );
                  })}

              {!loading && !filtered.length && (
                <EmptyState
                  icon={<Info size={17} />}
                  title={circulars.length ? "No assessments in this view" : "No notices to assess yet"}
                  description={
                    circulars.length
                      ? "Try another status filter. Assessments appear for every captured notice."
                      : "Once research captures official notices, each one is assessed against your profile here."
                  }
                  action={<ButtonLink href="/discover" variant="secondary">Open Discover</ButtonLink>}
                />
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card p-5">
              <p className="text-[12px] font-medium text-ink">Assessment summary</p>
              <div className="mt-3">
                <FactRow label="Notices assessed" value={counts.ALL || 0} />
                <FactRow label="Applies to you" value={counts.APPLIES || 0} />
                <FactRow label="Potentially applies" value={counts.POTENTIALLY_APPLIES || 0} />
                <FactRow label="Does not apply" value={counts.DOES_NOT_APPLY || 0} />
                <FactRow label="Unable to determine" value={counts.UNKNOWN || 0} />
              </div>
            </div>

            <div className={`rounded-card border p-5 ${missingFields.length ? "border-[#EFE4CB] bg-[#FBF7EE]" : "border-line bg-wash"}`}>
              <p className="text-[12px] font-medium text-ink">
                {missingFields.length ? "Missing from your profile" : "Profile complete for applicability"}
              </p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-secondary">
                {missingFields.length
                  ? missingFields.join(", ")
                  : "Branch, semester, scheme and institution are all available, so stated audiences can be matched."}
              </p>
            </div>

            <div className="rounded-card border border-line p-5">
              <p className="text-[12px] font-medium text-ink">How to read these labels</p>
              <ul className="mt-2.5 space-y-2 text-[11.5px] leading-relaxed text-secondary">
                <li>
                  <span className="font-medium text-success">Applies to you</span> — the stated audience matches your
                  profile. It is not a personal eligibility decision.
                </li>
                <li>
                  <span className="font-medium text-warning">Potentially applies</span> — a required profile field or
                  condition is unknown.
                </li>
                <li>
                  <span className="font-medium text-ink">Does not apply</span> — a stated condition differs from your
                  profile.
                </li>
                <li>
                  <span className="font-medium text-ink">Unable to determine</span> — the document does not state
                  enough to decide.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
