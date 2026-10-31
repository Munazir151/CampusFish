"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import AppShell from "@/components/AppShell";
import CircularCard from "@/components/CircularCard";
import {
  Badge,
  Button,
  ButtonLink,
  CardSkeleton,
  EmptyState,
  ErrorNotice,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { api } from "@/lib/api";
import { assessApplicability, useStudent } from "@/lib/student";
import { CATEGORY_META, CATEGORY_ORDER, CATEGORY_TONE, type Category, type Circular } from "@/lib/types";

const WINDOWS = [
  { key: "all", label: "Any time", days: null },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
];

const TONE_CHIP: Record<string, string> = {
  cobalt: "chip-cobalt",
  warning: "chip-warning",
  danger: "chip-danger",
  success: "chip-success",
  lime: "chip-lime",
  ink: "chip-ink",
  quiet: "chip-quiet",
  neutral: "",
};

export default function DiscoverPage() {
  const { user } = useStudent();
  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<Category | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [windowKey, setWindowKey] = useState("all");
  const [institution, setInstitution] = useState("ALL");
  const [relevanceOnly, setRelevanceOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.circulars({ limit: 200 });
      setCirculars(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the notice feed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const institutions = useMemo(() => {
    const names = circulars
      .map((item) => item.institution || item.source_name)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(names)).sort();
  }, [circulars]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    circulars.forEach((item) => map.set(item.category, (map.get(item.category) || 0) + 1));
    return map;
  }, [circulars]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const days = WINDOWS.find((entry) => entry.key === windowKey)?.days ?? null;
    const cutoff = days ? Date.now() - days * 86_400_000 : null;

    return circulars.filter((item) => {
      if (category !== "ALL" && item.category !== category) return false;
      if (institution !== "ALL" && (item.institution || item.source_name) !== institution) return false;
      if (cutoff && new Date(item.detected_at).getTime() < cutoff) return false;
      if (relevanceOnly && assessApplicability(item, user).status === "DOES_NOT_APPLY") return false;
      if (term) {
        const haystack = `${item.title} ${item.summary || ""} ${item.source_name || ""} ${item.institution || ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [circulars, category, institution, windowKey, relevanceOnly, query, user]);

  const activeFilters = [category !== "ALL", institution !== "ALL", windowKey !== "all", relevanceOnly, Boolean(query)].filter(Boolean).length;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-page px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <PageHeader
          eyebrow="Discover"
          title="Find what you might have missed."
          description="Every notice your college and university published, in one place. Filter it down to what matters to you."
          actions={
            <ButtonLink href="/research" variant="secondary">
              Manage sources <ArrowRight size={14} />
            </ButtonLink>
          }
        />

        {error && (
          <div className="mt-6">
            <ErrorNotice message={error} onRetry={() => void load()} />
          </div>
        )}

        {/* Controls */}
        <section className="mt-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search notices by title, summary or authority"
                className="input pl-10"
                aria-label="Search notices"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={windowKey}
                onChange={(event) => setWindowKey(event.target.value)}
                className="input w-auto min-w-[132px] py-2.5 text-[12.5px]"
                aria-label="Discovery date range"
              >
                {WINDOWS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
                className="input w-auto max-w-[220px] py-2.5 text-[12.5px]"
                aria-label="Institution"
              >
                <option value="ALL">All institutions</option>
                {institutions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setRelevanceOnly((value) => !value)}
                aria-pressed={relevanceOnly}
                className={`chip h-[38px] rounded-field px-3 transition-colors ${
                  relevanceOnly ? "border-acid bg-acid text-midnight" : "hover:bg-mist"
                }`}
              >
                <SlidersHorizontal size={12} /> Relevant to me
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCategory("ALL")}
              className={`chip rounded-full px-3 py-1.5 transition-colors ${
                category === "ALL" ? "border-acid bg-acid text-midnight" : "hover:bg-mist"
              }`}
            >
              All notices <span className={category === "ALL" ? "text-midnight/55" : "text-faint"}>{circulars.length}</span>
            </button>
            {CATEGORY_ORDER.filter((key) => (counts.get(key) || 0) > 0).map((key) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`chip rounded-full px-3 py-1.5 transition-colors ${
                  TONE_CHIP[CATEGORY_TONE[key]] ?? ""
                } ${category === key ? "ring-2 ring-current ring-offset-1 ring-offset-paper" : "hover:bg-mist"}`}
              >
                {CATEGORY_META[key].label}
                <span className="opacity-60">{counts.get(key) || 0}</span>
              </button>
            ))}
            {activeFilters > 0 && (
              <button
                onClick={() => {
                  setCategory("ALL");
                  setQuery("");
                  setWindowKey("all");
                  setInstitution("ALL");
                  setRelevanceOnly(false);
                }}
                className="text-[11.5px] text-secondary underline underline-offset-4 hover:text-ink"
              >
                Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </section>

        {/* Results */}
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <p className="text-[12.5px] text-secondary">
              {loading ? "Loading notices…" : `${filtered.length} notice${filtered.length === 1 ? "" : "s"} in this view`}
            </p>
            <p className="text-[11.5px] text-faint">Each notice links back to the official document.</p>
          </div>

          <div className="mt-4 space-y-3">
            {loading
              ? Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
              : filtered.map((circular) => <CircularCard key={circular.id} circular={circular} user={user} />)}

            {!loading && !filtered.length && (
              <EmptyState
                icon={<Search size={17} />}
                title={circulars.length ? "No notices match these filters" : "No notices captured yet"}
                description={
                  circulars.length
                    ? "Try a broader date range, another category, or clear the search term."
                    : "Connect an official source on the Research page and run research to populate Discover."
                }
                action={
                  circulars.length ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setCategory("ALL");
                        setQuery("");
                        setWindowKey("all");
                        setInstitution("ALL");
                        setRelevanceOnly(false);
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <ButtonLink href="/research" variant="primary">
                      Add a source
                    </ButtonLink>
                  )
                }
              />
            )}
          </div>
        </section>

        {/* Coverage */}
        <section className="mt-14 border-t border-line pt-10">
          <SectionHeading
            title="What we can read today"
            description="Notice types extracted from official documents in this build."
            action={<Badge tone="quiet">{CATEGORY_ORDER.filter((key) => counts.get(key)).length} in use</Badge>}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORY_ORDER.filter((key) => (counts.get(key) || 0) > 0).map((key) => (
              <span key={key} className="chip chip-quiet">
                {CATEGORY_META[key].label}
                <span className="text-faint">· {counts.get(key)}</span>
              </span>
            ))}
          </div>
          <p className="mt-4 max-w-2xl text-[12px] leading-relaxed text-faint">
            We never invent notices. If a category has no captured documents, it stays empty.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
