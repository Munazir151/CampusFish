"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Clock3,
  FileText,
  RefreshCw,
  ScanSearch,
  UserRound,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import CircularCard from "@/components/CircularCard";
import DeadlineRow from "@/components/DeadlineCard";
import {
  Badge,
  ButtonLink,
  CardSkeleton,
  EmptyState,
  ErrorNotice,
  FactRow,
  SectionHeading,
  Skeleton,
} from "@/components/ui";
import { api, formatDate, timeAgo } from "@/lib/api";
import {
  APPLICABILITY_META,
  assessApplicability,
  deadlineState,
  sortForStudent,
  useProfileExtras,
  useStudent,
} from "@/lib/student";
import type { AppConfig, Circular, Source, Stats } from "@/lib/types";

const FEED_LIMIT = 100;

const METRIC_BORDER: Record<string, string> = {
  cobalt: "border-t-cobalt",
  danger: "border-t-danger",
  success: "border-t-success",
  warning: "border-t-warning",
};

const METRIC_DOT: Record<string, string> = {
  cobalt: "bg-cobalt",
  danger: "bg-danger",
  success: "bg-success",
  warning: "bg-warning",
};

export default function OverviewPage() {
  const { user, loading: userLoading } = useStudent();
  const { extras } = useProfileExtras();

  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Welcome back");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [feed, statsRes, sourcesRes, configRes] = await Promise.all([
        api.circulars({ limit: FEED_LIMIT }),
        api.stats(),
        api.sources(),
        api.config(),
      ]);
      setCirculars(feed.items);
      setStats(statsRes);
      setSources(sourcesRes.items);
      setConfig(configRes);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message}. The research service could not be reached.`
          : "The research service could not be reached.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  }, []);

  const ranked = useMemo(() => (user ? sortForStudent(circulars, user) : circulars), [circulars, user]);

  const important = useMemo(
    () => ranked.filter((item) => deadlineState(item.days_left) !== "CLOSED").slice(0, 4),
    [ranked],
  );

  const missed = useMemo(() => {
    const candidates = ranked.filter((item) => {
      const assessment = assessApplicability(item, user);
      if (assessment.status !== "APPLIES" && assessment.status !== "POTENTIALLY_APPLIES") return false;
      return deadlineState(item.days_left) !== "CLOSED";
    });
    const preferred = candidates.filter((item) => !important.some((entry) => entry.id === item.id));
    return preferred.slice(0, 2);
  }, [ranked, important, user]);

  const upcoming = useMemo(() => {
    const shown = new Set(important.map((entry) => entry.id));
    const dated = circulars.filter((item) => item.deadline && !shown.has(item.id));
    const open = dated
      .filter((item) => deadlineState(item.days_left) !== "CLOSED")
      .sort((a, b) => (a.days_left ?? 9_999) - (b.days_left ?? 9_999));
    const closed = dated
      .filter((item) => deadlineState(item.days_left) === "CLOSED")
      .sort((a, b) => new Date(b.deadline as string).getTime() - new Date(a.deadline as string).getTime());
    return [...open, ...closed].slice(0, 5);
  }, [circulars, important]);

  const matches = useMemo(
    () => circulars.filter((item) => assessApplicability(item, user).status === "APPLIES").length,
    [circulars, user],
  );

  const enabledSources = sources.filter((source) => Boolean(source.enabled)).length;

  const metrics = [
    {
      label: "Notices in your feed",
      value: stats?.circulars ?? circulars.length,
      hint: stats?.alerts ? `${stats.alerts} personalised alerts prepared` : "No alerts created yet",
      tone: "cobalt",
    },
    {
      label: "Deadlines ahead",
      value: circulars.filter((item) => item.deadline && deadlineState(item.days_left) !== "CLOSED").length,
      hint: "Open, stated deadlines only",
      tone: "danger",
    },
    {
      label: "Match your profile",
      value: matches,
      hint: user ? "In this feed, by the audience stated in each notice" : "Complete your profile to personalise",
      tone: "success",
    },
    {
      label: "Sources researched",
      value: enabledSources,
      hint: config?.llm_configured ? "LLM classification enabled" : "Rule-based classification",
      tone: "warning",
    },
  ];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-page px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        {/* Greeting */}
        <header className="border-b border-line pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-cobalt">Your briefing</p>
              <h1 className="mt-2 text-[30px] font-semibold leading-[1.15] tracking-tightest sm:text-[38px]">
                {userLoading ? "Welcome back" : `${greeting}, ${user?.name?.split(" ")[0] || "student"}`}
              </h1>
              <p className="mt-2 text-[15px] text-secondary">Here is what needs your attention today.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink href="/discover" variant="secondary">
                Discover <ArrowRight size={14} />
              </ButtonLink>
              <ButtonLink href="/research" variant="primary">
                Research activity
              </ButtonLink>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <UserRound size={12} /> {user?.institution || "Institution not set"}
            </span>
            {user ? (
              <>
                <span className="text-faint">·</span>
                <span>{user.branch || "Branch not set"}</span>
                <span className="text-faint">·</span>
                <span>{user.semester ? `Semester ${user.semester}` : "Semester not set"}</span>
                <span className="text-faint">·</span>
                <span>{user.scheme ? `${user.scheme} scheme` : "Scheme not set"}</span>
                {extras.institutionType && (
                  <>
                    <span className="text-faint">·</span>
                    <span>{extras.institutionType}</span>
                  </>
                )}
              </>
            ) : (
              <Link href="/profile" className="link text-[12px]">
                Complete your academic profile
              </Link>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-faint">
              <Clock3 size={12} /> Last research {timeAgo(stats?.last_scan_at)}
            </span>
          </div>
        </header>

        {error && (
          <div className="mt-6">
            <ErrorNotice message={error} onRetry={() => void load()} />
          </div>
        )}

        {/* A. Academic overview */}
        <section className="mt-8">
          <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className={`border-t-2 bg-paper p-5 ${METRIC_BORDER[metric.tone] ?? "border-t-line"}`}
              >
                <p className="flex items-center gap-1.5 text-[11.5px] text-secondary">
                  <span className={`h-1.5 w-1.5 rounded-full ${METRIC_DOT[metric.tone] ?? "bg-faint"}`} />
                  {metric.label}
                </p>
                {loading ? (
                  <Skeleton className="mt-2 h-8 w-12" />
                ) : (
                  <p className="mt-1.5 text-[26px] font-medium leading-none tracking-tight">{metric.value}</p>
                )}
                <p className="mt-2.5 text-[10.5px] leading-relaxed text-faint">{metric.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-14">
          <div className="min-w-0">
            {/* B. Important for you */}
            <section className="rounded-card border border-line bg-wash p-5 sm:p-6">
              <SectionHeading
                title="Important for you"
                description="Ranked by what applies to your profile and how soon it closes."
                action={
                  <Link href="/discover" className="inline-flex items-center gap-1 text-[12px] font-medium text-secondary hover:text-ink">
                    View all <ArrowRight size={12} />
                  </Link>
                }
              />

              <div className="mt-5 space-y-3">
                {loading
                  ? Array.from({ length: 3 }).map((_, index) => <CardSkeleton key={index} />)
                  : important.map((circular) => <CircularCard key={circular.id} circular={circular} user={user} />)}

                {!loading && !important.length && (
                  <EmptyState
                    icon={<ScanSearch size={17} />}
                    title="Nothing in your feed yet"
                    description="CampusFish has not captured notices from your sources. Run research on the Research page, or add an official source to start."
                    action={
                      <ButtonLink href="/research" variant="primary">
                        <RefreshCw size={14} /> Open research
                      </ButtonLink>
                    }
                  />
                )}
              </div>
            </section>

            {/* C. You might have missed this */}
            {missed.length > 0 && (
            <section className="mt-14">
              <SectionHeading
                title="You might have missed this"
                description="Other notices that match your profile."
                action={<span className="text-[11.5px] text-faint">Also relevant to you</span>}
              />

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {missed.map((circular) => {
                  const assessment = assessApplicability(circular, user);
                  const meta = APPLICABILITY_META[assessment.status];
                  const audience = Object.entries(circular.applies_to || {})
                    .flatMap(([key, values]) =>
                      Array.isArray(values) && values.length
                        ? [`${key === "branches" ? "Branch" : key === "semesters" ? "Semester" : "Scheme"}: ${values.join(", ")}`]
                        : [],
                    )
                    .join(" · ");

                  return (
                    <article key={circular.id} className="card flex flex-col p-5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="text-[10.5px] text-faint">Discovered {timeAgo(circular.detected_at)}</span>
                      </div>

                      <h3 className="mt-3 text-[14px] font-medium leading-snug text-ink">{circular.title}</h3>

                      <dl className="mt-4 flex-1 space-y-2.5 text-[12px] leading-relaxed">
                        <div>
                          <dt className="text-faint">Why it matters</dt>
                          <dd className="mt-0.5 text-secondary">{assessment.note}</dd>
                        </div>
                        {circular.summary && (
                          <div>
                            <dt className="text-faint">Official summary</dt>
                            <dd className="mt-0.5 line-clamp-3 text-secondary">{circular.summary}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-faint">Who may benefit</dt>
                          <dd className="mt-0.5 text-secondary">{audience || "Audience not stated in the notice"}</dd>
                        </div>
                        <div>
                          <dt className="text-faint">Stated deadline</dt>
                          <dd className="mt-0.5 text-secondary">
                            {formatDate(circular.deadline)}
                            {circular.days_left !== null && circular.days_left !== undefined
                              ? circular.days_left < 0
                                ? " · closed"
                                : ` · ${circular.days_left} days remaining`
                              : ""}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-faint">Next action</dt>
                          <dd className="mt-0.5 text-secondary">{circular.action_required || "Not stated in the notice"}</dd>
                        </div>
                      </dl>

                      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                        <span className="truncate text-[11px] text-faint">{circular.source_name || "Source not recorded"}</span>
                        {circular.url ? (
                          <a
                            href={circular.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-cobalt hover:text-cobalt/75"
                          >
                            Official source <ArrowRight size={11} className="-rotate-45" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-faint">No source link</span>
                        )}
                      </div>
                    </article>
                  );
                })}

                {!loading && !missed.length && (
                  <div className="sm:col-span-2">
                    <EmptyState
                      icon={<FileText size={17} />}
                      title="No unread opportunities found yet"
                      description="This section only appears when a notice in your feed matches your stated academic profile. It is not a recommendation engine and does not invent opportunities."
                    />
                  </div>
                )}
              </div>
            </section>
            )}

            {/* D. Upcoming deadlines */}
            {upcoming.length > 0 && (
            <section className="mt-14">
              <SectionHeading
                title="Upcoming deadlines"
                description="Stated deadlines from official notices. Past deadlines stay visible as closed."
              />
              {loading ? (
                <div className="mt-4 space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : upcoming.length ? (
                <ul className="mt-4">
                  {upcoming.map((circular) => (
                    <DeadlineRow key={circular.id} circular={circular} />
                  ))}
                </ul>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    icon={<CalendarClock size={17} />}
                    title="No dated deadlines captured"
                    description="CampusFish only lists deadlines stated in official documents. If none have been captured, nothing is shown."
                  />
                </div>
              )}
            </section>
            )}
          </div>

          {/* Aside */}
          <aside className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-ink">Your academic profile</p>
                <Link href="/profile" className="text-[11.5px] text-secondary hover:text-ink">
                  Edit
                </Link>
              </div>
              {user ? (
                <div className="mt-3">
                  <p className="text-[14px] font-medium text-ink">{user.name}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-secondary">{user.institution || "Institution not set"}</p>
                  <div className="mt-3">
                    {extras.programme && <FactRow label="Programme" value={extras.programme} />}
                    {user.branch && <FactRow label="Branch" value={user.branch} />}
                    {user.semester && <FactRow label="Semester" value={`Semester ${user.semester}`} />}
                    {user.scheme && <FactRow label="Scheme" value={user.scheme} />}
                    {extras.institutionType && <FactRow label="Institution type" value={extras.institutionType} />}
                    {extras.admissionYear && <FactRow label="Admission year" value={extras.admissionYear} />}
                  </div>
                  {(!user.branch || !user.semester || !user.scheme) && (
                    <p className="mt-3 rounded-xl bg-mist px-3 py-2 text-[11px] leading-relaxed text-secondary">
                      Some fields are missing, so applicability may be reported as potentially applying.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-[12px] leading-relaxed text-secondary">
                  No profile on the server yet. Add your institution, branch and semester to personalise what appears here.
                </p>
              )}
              {!user && !userLoading && (
                <ButtonLink href="/profile" variant="primary" size="sm" className="mt-4 w-full">
                  Set up profile
                </ButtonLink>
              )}
            </div>

            <div className="card bg-wash p-5">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-cobalt" /> Research status
              </p>
              <div className="mt-3">
                <FactRow label="Last successful scan" value={stats?.last_scan_at ? timeAgo(stats.last_scan_at) : "Not yet"} />
                <FactRow label="Sources watched" value={enabledSources ? `${enabledSources} enabled` : "None"} />
                <FactRow label="Classification" value={config?.llm_configured ? "LLM + rules" : "Rules only"} />
                <FactRow label="Scanned notices" value={stats?.circulars ?? circulars.length} />
              </div>
              <ButtonLink href="/research" variant="secondary" size="sm" className="mt-4 w-full">
                Open research activity
              </ButtonLink>
            </div>

            <div className="rounded-card border border-line bg-wash p-5">
              <p className="text-[12px] font-medium text-ink">About this briefing</p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-secondary">
                Every item links to the official document it came from. CampusFish does not invent notices, deadlines
                or eligibility outcomes, and unknown values are shown as not specified.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
