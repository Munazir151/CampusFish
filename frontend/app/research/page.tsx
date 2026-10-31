"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Globe2,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ScanSearch,
  Trash2,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  Badge,
  Button,
  ButtonLink,
  Dialog,
  Disclosure,
  EmptyState,
  ErrorNotice,
  FactRow,
  Field,
  PageHeader,
  SectionHeading,
  Skeleton,
} from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, formatDateTime, timeAgo } from "@/lib/api";
import type { AgentRun, AppConfig, Circular, Health, ScanGroup, ScanRun, Source } from "@/lib/types";

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" | "cobalt" {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "PARTIAL" || status === "EMPTY") return "warning";
  return "cobalt";
}

const SOURCE_TEMPLATES = [
  {
    short: "Scholarships",
    name: "National Scholarship Portal",
    institution: "Government of India",
    url: "https://scholarships.gov.in/",
    goal: "Find the latest scholarship schemes for students, including eligibility, application windows and last dates. Return each scheme with its official detail or PDF URL. Do not invent schemes, amounts or dates.",
  },
  {
    short: "UGC schemes",
    name: "UGC Scholarships & Fellowships",
    institution: "University Grants Commission",
    url: "https://www.ugc.gov.in/",
    goal: "Find the latest scholarship, fellowship and research programme notices with eligibility and application deadlines. Return official detail or PDF URLs only.",
  },
  {
    short: "Internships",
    name: "AICTE Schemes & Internships",
    institution: "All India Council for Technical Education",
    url: "https://www.aicte-india.org/",
    goal: "Find the latest schemes, internships, fellowships and student programmes with eligibility, stipend and application deadlines. Return official document URLs only.",
  },
  {
    short: "Education loans",
    name: "Vidya Lakshmi Education Loan",
    institution: "Government of India",
    url: "https://www.vidyalakshmi.co.in/",
    goal: "Find education loan schemes, interest subsidy information, eligibility and application steps. Return official scheme or bank page URLs. Do not invent loan terms.",
  },
  {
    short: "Jobs & placements",
    name: "National Career Service",
    institution: "Ministry of Labour & Employment",
    url: "https://www.ncs.gov.in/",
    goal: "Find current job and placement opportunities for students and graduates, with organisation, eligibility and application deadlines. Do not invent listings.",
  },
];

function RunPanel({ run }: { run: ScanRun }) {
  const [open, setOpen] = useState(run.status === "RUNNING" || run.status === "PENDING");
  const [agent, setAgent] = useState<AgentRun | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !run.tinyfish_run_id) return;
    let alive = true;
    const load = async () => {
      try {
        const data = await api.agentRun(run.tinyfish_run_id as string);
        if (alive) {
          setAgent(data);
          setAgentError(null);
        }
      } catch (err) {
        if (alive) setAgentError(err instanceof Error ? err.message : "Live agent trace unavailable");
      }
    };
    void load();
    const timer = setInterval(() => {
      void load();
    }, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [open, run.tinyfish_run_id]);

  const steps = agent?.steps || [];

  return (
    <div className="rounded-xl border border-line">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-2 px-3.5 py-3 text-left transition-colors hover:bg-wash"
      >
        <Badge tone={statusTone(run.status)}>
          {run.status === "RUNNING" || run.status === "PENDING" ? <Loader2 size={10} className="animate-spin" /> : null}
          {run.status.toLowerCase()}
        </Badge>
        <span className="truncate text-[12px] font-medium text-ink">{run.source_name || "Source"}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2.5 text-[10.5px] text-faint">
          <span>{run.total_items_count} read</span>
          <span>· {run.new_items_count} new</span>
          <span>{open ? "−" : "+"}</span>
        </span>
      </button>

      {open && (
        <div className="animate-fade-in border-t border-line px-3.5 py-3">
          {run.error && (
            <p className="mb-2 rounded-lg border border-[#EEDCD9] bg-[#FBF3F2] px-2.5 py-2 text-[11.5px] leading-relaxed text-danger">
              {run.error}
            </p>
          )}

          {!run.tinyfish_run_id && run.status !== "FAILED" && (
            <p className="flex items-center gap-2 text-[11.5px] text-secondary">
              <Loader2 size={12} className="animate-spin" /> Waiting for the web agent to start…
            </p>
          )}

          {run.tinyfish_run_id && (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-faint">
                <span className="font-mono">{run.tinyfish_run_id.slice(0, 10)}</span>
                <span>{agent?.num_of_steps ?? steps.length} agent steps</span>
                {agent?.started_at && <span>started {timeAgo(agent.started_at)}</span>}
                {(run.status === "RUNNING" || run.status === "PENDING") && (
                  <span className="ml-auto inline-flex items-center gap-1.5 font-medium text-cobalt">
                    <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-cobalt" />
                    Live view
                  </span>
                )}
              </div>

              {agentError && <p className="mt-2 text-[11px] text-secondary">{agentError}</p>}

              {agent?.status === "PENDING" && (
                <p className="mt-2 flex items-start gap-2 rounded-lg bg-wash px-2.5 py-2 text-[11.5px] leading-relaxed text-secondary">
                  <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin" />
                  Queued at TinyFish. It starts as soon as a browser slot frees up — both sources were submitted
                  together.
                </p>
              )}

              <ol className="mt-2.5 space-y-1.5">
                {steps.slice(0, 8).map((step) => (
                  <li key={step.id} className="flex items-start gap-2 text-[11.5px] leading-snug">
                    <span
                      className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                        step.status === "COMPLETED" ? "bg-success" : "animate-soft-pulse bg-cobalt"
                      }`}
                    />
                    <span className="flex-1 text-secondary">{step.action}</span>
                    {step.duration && <span className="shrink-0 font-mono text-[10px] text-faint">{step.duration}</span>}
                  </li>
                ))}
                {!steps.length && !agentError && agent?.status !== "PENDING" && (
                  <li className="flex items-center gap-2 text-[11.5px] text-secondary">
                    <Loader2 size={11} className="animate-spin" /> Reading the agent trace…
                  </li>
                )}
              </ol>
              {steps.length > 8 && (
                <p className="mt-2 text-[10.5px] text-faint">Showing the first 8 steps from the live trace.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResearchPage() {
  const { push } = useToast();

  const [sources, setSources] = useState<Source[]>([]);
  const [scans, setScans] = useState<ScanGroup[]>([]);
  const [recent, setRecent] = useState<Circular[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [starting, setStarting] = useState(false);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanGroup | null>(null);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [savingSource, setSavingSource] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", institution: "", goal: "" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [sourcesRes, scansRes, feed, configRes] = await Promise.all([
        api.sources(),
        api.recentScans(),
        api.circulars({ limit: 6 }),
        api.config(),
      ]);
      setSources(sourcesRes.items);
      setScans(scansRes.items);
      setRecent(feed.items);
      setConfig(configRes);
      const healthRes = await api.health().catch(() => null);
      setHealth(healthRes);
      setSelectedScanId((current) => current ?? scansRes.items[0]?.scan_id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load research activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeScan = activeScanId !== null;
  const scanning = activeScan || (scan?.status === "RUNNING" || scan?.status === "PENDING");

  useEffect(() => {
    if (!activeScanId) return;
    let alive = true;

    const tick = async () => {
      try {
        const status = await api.scanStatus(activeScanId);
        if (!alive) return;
        setScan(status);
        if (status.status !== "RUNNING" && status.status !== "PENDING") {
          setActiveScanId(null);
          await load();
          push(
            status.status === "COMPLETED"
              ? `Research complete — ${status.new_items_count} new notice${status.new_items_count === 1 ? "" : "s"} captured`
              : status.status === "PARTIAL"
                ? `Research finished with some sources unavailable — ${status.new_items_count} new notices`
                : "Research failed. Check the source errors below.",
            status.status === "FAILED" ? "error" : "success",
          );
        }
      } catch {
        /* keep polling through transient errors */
      }
    };

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [activeScanId, load, push]);

  async function startResearch() {
    if (starting || scanning) return;
    setStarting(true);
    try {
      const res = await api.scan();
      setScan({
        scan_id: res.scan_id,
        status: "RUNNING",
        new_items_count: 0,
        runs: [],
        started_at: new Date().toISOString(),
      });
      setActiveScanId(res.scan_id);
      setSelectedScanId(res.scan_id);
      push("Research started. CampusFish is reading your sources.", "info");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not start research", "error");
    } finally {
      setStarting(false);
    }
  }

  async function toggleSource(source: Source) {
    try {
      await api.updateSource(source.id, { enabled: !source.enabled });
      await load();
      push(source.enabled ? "Source paused" : "Source enabled", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not update source", "error");
    }
  }

  async function removeSource(source: Source) {
    if (!window.confirm(`Stop watching "${source.name}"? Existing notices are kept.`)) return;
    try {
      await api.deleteSource(source.id);
      await load();
      push("Source removed", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not remove source", "error");
    }
  }

  async function addSource(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.url.trim()) return;
    setSavingSource(true);
    try {
      await api.createSource({
        name: form.name.trim(),
        url: form.url.trim(),
        institution: form.institution.trim() || undefined,
        goal: form.goal.trim() || undefined,
      });
      setForm({ name: "", url: "", institution: "", goal: "" });
      setAddOpen(false);
      await load();
      push("Source added. The next research run will read it.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not add source", "error");
    } finally {
      setSavingSource(false);
    }
  }

  const selected = useMemo(() => {
    if (activeScanId && scan?.scan_id === activeScanId) return scan;
    return scans.find((item) => item.scan_id === selectedScanId) || scans[0] || null;
  }, [scans, selectedScanId, scan, activeScanId]);

  const lastSuccess = useMemo(() => {
    const completed = scans.find((item) => item.status === "COMPLETED");
    return completed?.finished_at || completed?.started_at || null;
  }, [scans]);

  const enabledSources = sources.filter((source) => Boolean(source.enabled)).length;
  const failedRuns = selected?.runs.filter((run) => run.status === "FAILED") || [];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-page px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <PageHeader
          eyebrow="Research activity"
          title="Research official sources."
          description="CampusFish reads the websites institutions actually publish on. This page shows the live state of that research — what was reached, what was found, and what failed."
          actions={
            <Button variant="primary" onClick={startResearch} disabled={starting || scanning}>
              {starting || scanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {scanning ? "Research in progress" : "Run research"}
            </Button>
          }
        />

        {error && (
          <div className="mt-6">
            <ErrorNotice message={error} onRetry={() => void load()} />
          </div>
        )}

        {/* Status strip */}
        <section className="mt-8 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Last successful research",
              value: lastSuccess ? timeAgo(lastSuccess) : "Not yet",
              hint: lastSuccess ? formatDateTime(lastSuccess) : "No completed scan recorded",
            },
            {
              label: "Sources watched",
              value: `${enabledSources}`,
              hint: `${sources.length} configured · ${sources.length - enabledSources} paused`,
            },
            {
              label: "Web agent",
              value: health ? (health.tinyfish_configured ? "Connected" : "Not configured") : "Unknown",
              hint: health?.tinyfish_configured ? "TinyFish browser agent available" : "Set the agent API key on the server",
            },
            {
              label: "Classification",
              value: config?.llm_configured ? "LLM + rules" : "Rules only",
              hint: config?.llm_model ? config.llm_model : "Model not configured",
            },
          ].map((item) => (
            <div key={item.label} className="bg-paper p-5">
              <p className="text-[11.5px] text-secondary">{item.label}</p>
              <p className="mt-1.5 text-[20px] font-medium leading-none tracking-tight">{item.value}</p>
              <p className="mt-2 text-[10.5px] leading-relaxed text-faint">{item.hint}</p>
            </div>
          ))}
        </section>

        {scanning && scan && (
          <section className="mt-5 rounded-card border border-cobalt/20 bg-cobalt/[0.03] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Loader2 size={13} className="animate-spin text-secondary" />
              <p className="text-[12.5px] font-medium text-ink">Researching sources</p>
              <span className="text-[11px] text-faint">
                {scan.runs.length} source{scan.runs.length === 1 ? "" : "s"} in this run · {scan.new_items_count} new so far
              </span>
            </div>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {scan.runs.map((run) => (
                <div key={run.id} className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-[11.5px]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      run.status === "COMPLETED"
                        ? "bg-success"
                        : run.status === "FAILED"
                          ? "bg-danger"
                          : "animate-soft-pulse bg-cobalt"
                    }`}
                  />
                  <span className="truncate text-ink">{run.source_name || "Starting"}</span>
                  <span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.08em] text-faint">{run.status}</span>
                </div>
              ))}
              {!scan.runs.length && <p className="text-[11.5px] text-secondary">Waiting for the first source to report…</p>}
            </div>
            <p className="mt-2.5 text-[10.5px] text-faint">
              A run can take a couple of minutes. Statuses shown here come from the backend, not from a simulation.
            </p>
          </section>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-12">
          {/* Runs */}
          <div className="min-w-0">
            <SectionHeading
              title="Research runs"
              description="Each run is one pass across your enabled sources."
              action={scans.length > 1 ? <span className="eyebrow">{scans.length} recent runs</span> : undefined}
            />

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="card space-y-3 p-4">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : selected ? (
                <>
                  <div className="card p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone(selected.status)}>{selected.status.toLowerCase()}</Badge>
                      <span className="font-mono text-[10.5px] text-faint">{selected.scan_id.slice(0, 8)}</span>
                      <span className="text-[11px] text-secondary">started {timeAgo(selected.started_at)}</span>
                      <span className="ml-auto text-[11.5px] text-secondary">
                        <span className="font-medium text-ink">{selected.new_items_count}</span> new notices
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      {selected.runs.map((run) => (
                        <RunPanel key={run.id} run={run} />
                      ))}
                      {!selected.runs.length && (
                        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-[11.5px] text-secondary">
                          This run has no recorded source entries yet.
                        </p>
                      )}
                    </div>

                    {failedRuns.length > 0 && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#EEDCD9] bg-[#FBF3F2] p-3">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-danger" />
                        <p className="text-[11px] leading-relaxed text-danger">
                          {failedRuns.length} source{failedRuns.length === 1 ? "" : "s"} could not be read in this run.
                          Expand the run to see the error returned by the source.
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-[10.5px] text-faint">
                      <span className="inline-flex items-center gap-1">
                        <Globe2 size={11} /> {selected.runs.length} source{selected.runs.length === 1 ? "" : "s"} attempted
                      </span>
                      <span>Started {formatDateTime(selected.started_at)}</span>
                      {selected.finished_at && <span>Finished {formatDateTime(selected.finished_at)}</span>}
                    </div>
                  </div>

                  {scans.length > 1 && (
                    <div className="card p-4">
                      <p className="text-[12px] font-medium text-ink">Recent research history</p>
                      <div className="mt-2.5 space-y-1.5">
                        {scans.map((item) => (
                          <button
                            key={item.scan_id}
                            onClick={() => {
                              setActiveScanId(null);
                              setSelectedScanId(item.scan_id);
                            }}
                            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                              item.scan_id === selected.scan_id ? "border-cobalt/40 bg-cobalt/[0.04]" : "border-line hover:bg-wash"
                            }`}
                          >
                            <Badge tone={statusTone(item.status)}>{item.status.toLowerCase()}</Badge>
                            <span className="truncate text-[11.5px] text-secondary">{timeAgo(item.started_at)}</span>
                            <span className="ml-auto shrink-0 text-[10.5px] text-faint">{item.new_items_count} new</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  icon={<ScanSearch size={17} />}
                  title="No research runs yet"
                  description="Add an official source, then run research. This page will show every source, its status and the documents that came back."
                  action={
                    <Button variant="primary" onClick={() => setAddOpen(true)}>
                      <Plus size={14} /> Add a source
                    </Button>
                  }
                />
              )}
            </div>

            {/* Recent documents */}
            <section className="mt-12">
              <SectionHeading title="Recently discovered documents" description="The newest notices captured from your sources." />
              <div className="mt-4 divide-y divide-line rounded-card border border-line">
                {loading
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="p-4">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="mt-2 h-3 w-1/3" />
                      </div>
                    ))
                  : recent.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium text-ink">{item.title}</p>
                          <p className="mt-0.5 truncate text-[10.5px] text-secondary">
                            {item.source_name || "Source not stated"} · discovered {timeAgo(item.detected_at)}
                          </p>
                        </div>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-cobalt hover:text-cobalt/75"
                          >
                            Source <ArrowUpRight size={11} />
                          </a>
                        )}
                      </div>
                    ))}
                {!loading && !recent.length && (
                  <p className="px-4 py-6 text-center text-[12px] text-secondary">No documents captured yet.</p>
                )}
              </div>
            </section>
          </div>

          {/* Sources */}
          <aside>
            <div className="overflow-hidden rounded-card border border-line bg-paper">
              <div className="flex items-center justify-between gap-2 border-b border-line bg-mist px-4 py-3">
                <div>
                  <p className="text-[12.5px] font-medium text-ink">Sources</p>
                  <p className="mt-0.5 text-[11px] text-secondary">
                    {enabledSources} active · {sources.length} configured
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                  <Plus size={12} /> Add
                </Button>
              </div>

              <div className="divide-y divide-line">
                {loading
                  ? Array.from({ length: 2 }).map((_, index) => (
                      <div key={index} className="px-4 py-3">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="mt-2 h-3 w-1/2" />
                      </div>
                    ))
                  : sources.map((source) => (
                      <div
                        key={source.id}
                        className={`border-l-2 px-4 py-3 ${source.enabled ? "border-l-success" : "border-l-line"}`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                              source.enabled ? "bg-success" : "bg-faint"
                            }`}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-medium text-ink">{source.name}</p>
                            <p className="mt-0.5 truncate text-[11px] text-secondary">
                              {source.institution || "Institution not set"}
                            </p>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="mt-1 inline-flex items-center gap-1 truncate text-[10.5px] text-faint hover:text-cobalt"
                            >
                              {source.url.replace(/^https?:\/\//, "")} <ArrowUpRight size={10} />
                            </a>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => void toggleSource(source)}
                              className="rounded-full p-1.5 text-secondary transition-colors hover:bg-mist hover:text-ink"
                              aria-label={source.enabled ? `Pause ${source.name}` : `Enable ${source.name}`}
                              title={source.enabled ? "Pause source" : "Enable source"}
                            >
                              {source.enabled ? <Pause size={12} /> : <Play size={12} />}
                            </button>
                            <button
                              onClick={() => void removeSource(source)}
                              className="rounded-full p-1.5 text-faint transition-colors hover:bg-mist hover:text-danger"
                              aria-label={`Remove ${source.name}`}
                              title="Remove source"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 pl-3.5">
                          <span className={`chip !py-0 !text-[9.5px] ${source.enabled ? "chip-success" : "chip-quiet"}`}>
                            {source.enabled ? "Watching" : "Paused"}
                          </span>
                          <span className="text-[10.5px] text-faint">
                            {source.last_scanned_at ? `Read ${timeAgo(source.last_scanned_at)}` : "Not read yet"}
                          </span>
                        </div>
                      </div>
                    ))}

                {!loading && !sources.length && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-[12.5px] font-medium text-ink">No sources configured</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-secondary">
                      Add official pages for your institution, scholarships, education loans, internships or jobs to
                      begin research.
                    </p>
                    <Button size="sm" variant="primary" className="mt-3" onClick={() => setAddOpen(true)}>
                      Add a source
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-card border border-line bg-wash p-4">
              <p className="text-[12px] font-medium text-ink">Research integrity</p>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-secondary">
                <li className="flex gap-2">
                  <Check size={11} className="mt-1 shrink-0 text-success" /> Statuses come from the backend scan records.
                </li>
                <li className="flex gap-2">
                  <Check size={11} className="mt-1 shrink-0 text-success" /> A quiet feed with failed sources is reported
                  as failed, not empty.
                </li>
                <li className="flex gap-2">
                  <Check size={11} className="mt-1 shrink-0 text-success" /> No live browser activity is simulated.
                </li>
              </ul>
              {health && !health.tinyfish_configured && (
                <p className="mt-3 rounded-xl border border-[#EFE4CB] bg-[#FBF7EE] px-3 py-2 text-[10.5px] leading-relaxed text-warning">
                  The web agent is not configured on this deployment. Research runs will fail until the server has an
                  agent API key.
                </p>
              )}
            </div>

            {config?.default_goal && (
              <div className="mt-4 rounded-card border border-line p-4">
                <p className="text-[11px] font-medium text-ink">Instruction sent to the agent</p>
                <p className="mt-1.5 line-clamp-5 text-[10.5px] leading-relaxed text-faint">{config.default_goal}</p>
              </div>
            )}
          </aside>
        </div>
      </div>

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add an official source"
        description="Use the institution's circulars or notices page. CampusFish reads it read-only and never submits forms."
      >
        <form onSubmit={addSource} className="space-y-4">
          <div>
            <p className="text-[12px] font-medium text-ink">Start from an official source</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-secondary">
              Optional. Fills the details below with a starting point you can edit.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SOURCE_TEMPLATES.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  onClick={() =>
                    setForm({
                      name: template.name,
                      url: template.url,
                      institution: template.institution,
                      goal: template.goal,
                    })
                  }
                  className="chip rounded-full transition-colors hover:border-cobalt/40 hover:text-cobalt"
                >
                  {template.short}
                </button>
              ))}
            </div>
          </div>
          <Field label="Source name" htmlFor="source-name">
            <input
              id="source-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="University examination circulars"
              className="input"
              required
            />
          </Field>
          <Field label="Website URL" htmlFor="source-url" hint="Must be a public page. Documents linked from it are read next.">
            <input
              id="source-url"
              type="url"
              value={form.url}
              onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
              placeholder="https://university.edu.in/circulars"
              className="input"
              required
            />
          </Field>
          <Field label="Institution (optional)" htmlFor="source-institution">
            <input
              id="source-institution"
              value={form.institution}
              onChange={(event) => setForm((prev) => ({ ...prev, institution: event.target.value }))}
              placeholder="Institution this source belongs to"
              className="input"
            />
          </Field>
          <Field
            label="What should CampusFish look for? (optional)"
            htmlFor="source-goal"
            hint="Overrides the default instruction for this source. Useful for scholarship, loan, internship or job portals with an unusual layout."
          >
            <textarea
              id="source-goal"
              rows={3}
              value={form.goal}
              onChange={(event) => setForm((prev) => ({ ...prev, goal: event.target.value }))}
              placeholder="Find the latest scholarship schemes with eligibility, application windows and official PDF links."
              className="input resize-none"
            />
          </Field>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="quiet" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={savingSource}>
              {savingSource ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add source
            </Button>
          </div>
        </form>
      </Dialog>

      <div className="mx-auto w-full max-w-page px-5 sm:px-8">
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <p className="text-[11.5px] text-secondary">Looking for the live browser trace?</p>
          <ButtonLink href="/discover" variant="quiet" size="sm">
            Browse captured documents <ArrowUpRight size={12} />
          </ButtonLink>
        </div>
      </div>
    </AppShell>
  );
}
