"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowUpRight, FileSearch, GitCompare, Link2Off, RefreshCw } from "lucide-react";
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
import { api, formatDate, formatDateTime, timeAgo } from "@/lib/api";
import { useStudent } from "@/lib/student";
import { CATEGORY_META, type Circular, type Source } from "@/lib/types";

const REVISION_CUES = /(revised|revision|corrigendum|amended|amendment|addendum|extension|extended|modified|updated|re-?issued|supersed)/i;

const COMPARISON_REQUIREMENTS = [
  "Original document title and issuing authority",
  "Previous version with its publication date",
  "Current version with its publication date",
  "Both original source URLs",
  "Changed sections, highlighted without altering the text",
  "Added, removed and modified provisions",
  "Potential student impact and who is affected",
  "What the student should do next",
];

export default function ChangesPage() {
  const { user } = useStudent();
  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [feed, sourcesRes] = await Promise.all([api.circulars({ limit: 100 }), api.sources()]);
      setCirculars(feed.items);
      setSources(sourcesRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load source documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revisionSignals = useMemo(
    () => circulars.filter((item) => REVISION_CUES.test(item.title) || REVISION_CUES.test(item.summary || "")),
    [circulars],
  );

  const recent = useMemo(
    () =>
      [...circulars]
        .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
        .slice(0, 6),
    [circulars],
  );

  const lastResearch = useMemo(() => {
    const stamps = sources
      .map((source) => source.last_scanned_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return stamps[0] || null;
  }, [sources]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-page px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <PageHeader
          eyebrow="Change intelligence"
          title="What changed?"
          description="Understand how institutional policies, academic rules and opportunities evolve over time."
          actions={
            <ButtonLink href="/research" variant="secondary">
              Research sources <RefreshCw size={13} className="text-cobalt" />
            </ButtonLink>
          }
        />

        {/* Availability */}
        <section className="mt-8">
          <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-warning">
              <GitCompare size={16} />
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13.5px] font-medium text-ink">Document comparison is not connected yet</p>
                <Badge tone="warning">Interface prepared</Badge>
              </div>
              <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-secondary">
                CampusIntel currently stores each notice it reads, but it does not retain previous versions of the same
                document. Without an earlier version there is no evidence to compare, so this page does not invent a
                diff, historical dates or changed provisions. What it can show from real data is below.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-3">
            {[
              ["Documents on record", String(circulars.length), "Latest captured notices analysed on this page"],
              ["Version history", "Not available", "Previous document versions are not stored"],
              ["Sources with a completed scan", String(sources.filter((source) => source.last_scanned_at).length), lastResearch ? `Last reached ${timeAgo(lastResearch)}` : "No successful scan recorded"],
            ].map(([label, value, hint]) => (
              <div key={label} className="bg-paper p-5">
                <p className="text-[11.5px] text-secondary">{label}</p>
                <p className="mt-1.5 text-[22px] font-medium leading-none tracking-tight">{value}</p>
                <p className="mt-2 text-[10.5px] leading-relaxed text-faint">{hint}</p>
              </div>
            ))}
          </div>
        </section>

        {error && (
          <div className="mt-6">
            <ErrorNotice message={error} onRetry={() => void load()} />
          </div>
        )}

        {/* Update signals */}
        <section className="mt-12">
          <SectionHeading
            title="Documents that indicate an update"
            description="Titles that explicitly signal a revision, corrigendum or extension. A signal is not a verified change."
          />

          <div className="mt-5 space-y-3">
            {loading
              ? Array.from({ length: 2 }).map((_, index) => <CardSkeleton key={index} />)
              : revisionSignals.map((circular) => (
                  <Disclosure
                    key={circular.id}
                    summary={
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="warning">Revision indicated</Badge>
                          <span className="text-[11px] text-faint">{CATEGORY_META[circular.category]?.label}</span>
                        </div>
                        <p className="mt-1.5 text-[13.5px] font-medium leading-snug text-ink">{circular.title}</p>
                        <p className="mt-1 text-[11.5px] text-secondary">
                          {circular.source_name || circular.institution || "Authority not stated"} · published{" "}
                          {formatDate(circular.published_date)}
                        </p>
                      </div>
                    }
                    meta={
                      <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-secondary">
                        <AlertCircle size={13} className="mt-0.5 shrink-0 text-warning" />
                        The title indicates an update, but no earlier version is stored for this document, so no
                        verified comparison can be produced.
                      </p>
                    }
                  >
                    <div className="flex flex-col gap-5 lg:flex-row">
                      <div className="flex-1">
                        <p className="eyebrow">Previous version</p>
                        <div className="mt-2 rounded-xl border border-dashed border-line bg-wash p-4">
                          <div className="flex items-center gap-2 text-secondary">
                            <Link2Off size={14} />
                            <p className="text-[12.5px] font-medium">No earlier version on record</p>
                          </div>
                          <p className="mt-1.5 text-[11.5px] leading-relaxed text-secondary">
                            CampusIntel has not captured an earlier copy of this document, so it cannot state what was
                            added, removed or modified. Nothing is inferred.
                          </p>
                        </div>
                        <div className="mt-4">
                          <FactRow label="Publication date" value={formatDate(circular.published_date)} />
                          <FactRow label="Discovery date" value={formatDateTime(circular.detected_at)} />
                          <FactRow label="Effective date" value="Not specified" />
                          <FactRow label="Application deadline" value={formatDate(circular.deadline)} />
                        </div>
                      </div>

                      <div className="flex-1">
                        <p className="eyebrow">Current version (as captured)</p>
                        <div className="mt-2 rounded-xl border border-line p-4">
                          <p className="text-[12.5px] font-medium text-ink">{circular.title}</p>
                          <p className="mt-2 text-[12px] leading-relaxed text-secondary">
                            {circular.summary || "No summary was extracted from this document."}
                          </p>
                          {circular.action_required && (
                            <p className="mt-2 text-[11.5px] leading-relaxed text-body">
                              <span className="font-medium text-ink">Stated action:</span> {circular.action_required}
                            </p>
                          )}
                          <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                            <span className="text-[11px] text-faint">{circular.source_name || "Source not recorded"}</span>
                            {circular.url && (
                              <a
                                href={circular.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-cobalt hover:text-cobalt/75"
                              >
                                Original source <ArrowUpRight size={12} />
                              </a>
                            )}
                          </div>
                        </div>
                        <p className="mt-3 text-[11px] leading-relaxed text-faint">
                          This is the captured text, not a comparison. Applicability is assessed separately on the
                          Eligibility page.
                        </p>
                      </div>
                    </div>
                  </Disclosure>
                ))}

            {!loading && !revisionSignals.length && (
              <EmptyState
                icon={<FileSearch size={17} />}
                title="No revision signals in the current documents"
                description="None of the captured documents mention a revision, corrigendum or extension in their title or summary. That does not mean nothing changed — it means no change is evidenced yet."
                action={
                  <ButtonLink href="/research" variant="secondary">
                    Check research activity
                  </ButtonLink>
                }
              />
            )}
          </div>
        </section>

        {/* Recent documents */}
        <section className="mt-14">
          <SectionHeading
            title="Recently captured documents"
            description="Publication and discovery dates are kept separate. A document's page existing is not evidence that an application is open."
          />
          <div className="mt-4 overflow-hidden rounded-card border border-line">
            <div className="hidden grid-cols-[1.6fr_0.8fr_0.8fr_0.7fr] gap-4 border-b border-line bg-wash px-5 py-2.5 text-[10.5px] uppercase tracking-[0.1em] text-faint sm:grid">
              <span>Document</span>
              <span>Authority</span>
              <span>Published</span>
              <span className="text-right">Discovered</span>
            </div>
            {loading ? (
              <div className="space-y-3 p-5">
                <CardSkeleton />
              </div>
            ) : recent.length ? (
              recent.map((circular) => (
                <div
                  key={circular.id}
                  className="grid gap-1 border-b border-line px-5 py-3.5 last:border-0 sm:grid-cols-[1.6fr_0.8fr_0.8fr_0.7fr] sm:items-center sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-ink">{circular.title}</p>
                    <p className="mt-0.5 text-[10.5px] text-faint">{CATEGORY_META[circular.category]?.label}</p>
                  </div>
                  <span className="truncate text-[11.5px] text-secondary">{circular.source_name || "Not stated"}</span>
                  <span className="text-[11.5px] text-secondary">{formatDate(circular.published_date)}</span>
                  <span className="text-[11.5px] text-secondary sm:text-right">{timeAgo(circular.detected_at)}</span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[12.5px] text-secondary">
                No documents have been captured yet. Run research to read your first source.
              </div>
            )}
          </div>
          {user && (
            <p className="mt-3 text-[11px] text-faint">
              Applicability to {user.name} is evaluated on the Eligibility page, not assumed here.
            </p>
          )}
        </section>

        {/* Requirements */}
        <section className="mt-14 border-t border-line pt-10">
          <SectionHeading
            title="What a verified comparison will include"
            description="These are the minimum fields before CampusIntel publishes a reported change."
          />
          <div className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {COMPARISON_REQUIREMENTS.map((requirement) => (
              <div key={requirement} className="flex items-start gap-2.5 border-b border-line py-2.5 last:border-0">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-faint" />
                <p className="text-[12.5px] leading-relaxed text-secondary">{requirement}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-3xl text-[11.5px] leading-relaxed text-faint">
            Until version history is stored by the backend, this page reports availability honestly rather than
            presenting a plausible-looking diff. Revised regulations are also never assumed to apply
            retrospectively.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
