"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Loader2, MessageSquare, Search, Send, Sparkle } from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  Badge,
  Button,
  ButtonLink,
  ErrorNotice,
  PageHeader,
  SectionHeading,
  SourceLink,
} from "@/components/ui";
import { api, formatDate, timeAgo } from "@/lib/api";
import { CATEGORY_META, type AppConfig, type AskResponse, type Circular } from "@/lib/types";

const SUGGESTED = [
  "Is there any supplementary examination application available for my semester?",
  "Am I eligible for this scholarship?",
  "What changed in my university's examination regulations?",
  "Which internships or jobs are currently relevant to my programme?",
  "Are there any scholarships or education loans open for my batch?",
  "Does this revised academic policy apply to my admission batch?",
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "there", "any", "are", "does", "what", "which", "about", "from",
  "have", "has", "was", "were", "will", "would", "can", "could", "should", "into", "your", "you", "mine", "my",
  "our", "their", "its", "currently", "available", "relevant", "apply", "applies", "changed", "change", "please",
  "tell", "know", "how", "when", "where", "who", "why", "semester", "programme", "program", "university",
]);

function keywords(question: string): string[] {
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3 && !STOPWORDS.has(word)),
    ),
  );
}

export default function AskPage() {
  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, cfg] = await Promise.all([
        api.circulars({ limit: 200 }),
        api.config().catch(() => null),
      ]);
      setCirculars(res.items);
      setConfig(cfg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the document index");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const matches = useMemo(() => {
    if (!asked) return [];
    const terms = keywords(asked);
    if (!terms.length) return [];
    return circulars
      .map((item) => {
        const haystack = `${item.title} ${item.summary || ""} ${item.raw_text || ""} ${item.source_name || ""}`.toLowerCase();
        const score = terms.reduce((total, term) => (haystack.includes(term) ? total + 1 : total), 0);
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((entry) => entry.item);
  }, [asked, circulars]);

  async function ask(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setAsked(trimmed);
    setSearching(true);
    setAnswer(null);
    setAnswerError(null);
    setAnswerLoading(true);
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem("nr_user_id") : null;
      const result = await api.ask(trimmed, stored || undefined);
      setAnswer(result);
    } catch (err) {
      setAnswerError(err instanceof Error ? err.message : "Could not reach the answer service");
    } finally {
      setSearching(false);
      setAnswerLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-page px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <PageHeader
          eyebrow="Ask CampusIntel"
          title="Ask a question about your academic world."
          description="Answers are written by a local model from the official notices CampusIntel has captured — with a link to every document used. If the notices do not cover it, it says so instead of guessing."
          actions={
            <Badge tone={config?.llm_configured ? "success" : "warning"}>
              {config?.llm_configured ? "Grounded answers" : "Evidence only"}
            </Badge>
          }
        />

        {error && (
          <div className="mt-6">
            <ErrorNotice message={error} onRetry={() => void load()} />
          </div>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_300px] lg:gap-14">
          <div className="min-w-0">
            {/* Composer */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                ask(question);
              }}
              className="card p-4 sm:p-5"
            >
              <label htmlFor="ask-input" className="text-[12px] font-medium text-ink">
                Your question
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                <textarea
                  id="ask-input"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={2}
                  placeholder="Ask about examinations, deadlines, policy changes or eligibility…"
                  className="input min-h-[64px] flex-1 resize-none"
                />
                <Button type="submit" variant="primary" disabled={!question.trim()} className="sm:mb-0.5">
                  <Send size={13} /> Ask
                </Button>
              </div>
              <p className="mt-2.5 text-[10.5px] text-faint">
                Questions and searches run against your captured notices only. No external knowledge is used.
              </p>
            </form>

            {/* Suggested questions */}
            <div className="mt-6">
              <p className="eyebrow">Suggested questions</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTED.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => ask(suggestion)}
                    className="rounded-full border border-line px-3 py-1.5 text-left text-[11.5px] text-secondary transition-colors hover:border-cobalt/40 hover:bg-wash hover:text-cobalt"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Response */}
            {asked && (
              <section className="mt-10 animate-fade-up">
                <div className="flex items-center gap-2 border-b border-line pb-3">
                  <MessageSquare size={14} className="text-secondary" />
                  <p className="text-[13px] font-medium text-ink">{asked}</p>
                </div>

                {answerLoading && (
                  <div className="mt-5 flex items-center gap-2 rounded-card border border-line bg-wash p-5 text-[12.5px] text-secondary">
                    <Loader2 size={14} className="animate-spin" />
                    Reading captured notices and drafting an answer…
                  </div>
                )}

                {!answerLoading && answerError && (
                  <div className="mt-5">
                    <ErrorNotice message={answerError} onRetry={() => void ask(asked)} />
                  </div>
                )}

                {!answerLoading && !answerError && answer && (
                  <div className="mt-5 rounded-card border border-[#DCE9DF] bg-[#F2F7F3] p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-medium text-ink">Answer</p>
                      <Badge tone={answer.generated ? "success" : "quiet"}>
                        {answer.generated ? "Grounded in captured notices" : "Evidence only"}
                      </Badge>
                      {answer.matched > 0 && (
                        <span className="text-[10.5px] text-faint">
                          {answer.matched} document{answer.matched === 1 ? "" : "s"} checked
                        </span>
                      )}
                    </div>
                    <p className="mt-2.5 whitespace-pre-line text-[13.5px] leading-relaxed text-body">
                      {answer.answer}
                    </p>

                    {answer.citations.length > 0 && (
                      <ol className="mt-4 space-y-1.5 border-t border-[#DCE9DF] pt-3">
                        {answer.citations.map((citation) => (
                          <li
                            key={citation.index}
                            className="flex items-start gap-2 text-[11.5px] leading-relaxed text-secondary"
                          >
                            <span className="mt-0.5 shrink-0 font-mono text-[10px] text-faint">
                              [{citation.index}]
                            </span>
                            <span className="min-w-0 flex-1">
                              {citation.url ? (
                                <a
                                  href={citation.url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="font-medium text-ink hover:text-cobalt"
                                >
                                  {citation.title}
                                </a>
                              ) : (
                                <span className="font-medium text-ink">{citation.title}</span>
                              )}
                              <span className="text-faint">
                                {" "}
                                · {citation.source_name || "Official source"}
                                {citation.deadline ? ` · deadline ${formatDate(citation.deadline)}` : ""}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}

                    <p className="mt-3 text-[10.5px] leading-relaxed text-faint">
                      {answer.generated
                        ? `Written by ${
                            config?.llm_model || answer.model || "the local model"
                          } from the documents above. Always verify the original notice.`
                        : "The local model was unavailable, so this is a summary of the closest captured documents."}
                    </p>
                  </div>
                )}

                <div className="mt-8">
                  <SectionHeading
                    title="Official documents matching your question"
                    description={
                      loading
                        ? "Searching captured notices…"
                        : `${matches.length} document${matches.length === 1 ? "" : "s"} matched from ${circulars.length} captured notices.`
                    }
                    action={searching ? <Loader2 size={14} className="animate-spin text-secondary" /> : undefined}
                  />

                  <div className="mt-4 space-y-3">
                    {loading && <p className="text-[12px] text-secondary">Loading the document index…</p>}

                    {!loading &&
                      matches.map((item, index) => (
                        <article key={item.id} className="card p-4">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cobalt/10 font-mono text-[10px] text-cobalt">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge>{CATEGORY_META[item.category]?.label}</Badge>
                                <span className="text-[10.5px] text-faint">
                                  Published {formatDate(item.published_date)} · discovered {timeAgo(item.detected_at)}
                                </span>
                              </div>
                              <p className="mt-1.5 text-[13px] font-medium leading-snug text-ink">{item.title}</p>
                              {item.summary && (
                                <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-secondary">
                                  {item.summary}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                                <span className="text-[10.5px] text-faint">
                                  {item.source_name || item.institution || "Authority not stated"}
                                </span>
                                {item.deadline && (
                                  <span className="text-[10.5px] text-faint">Deadline {formatDate(item.deadline)}</span>
                                )}
                                <span className="ml-auto">
                                  <SourceLink url={item.url} label="View document" />
                                </span>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}

                    {!loading && !matches.length && (
                      <div className="rounded-card border border-dashed border-line p-6 text-center">
                        <Search size={17} className="mx-auto text-faint" />
                        <p className="mt-2 text-[12.5px] font-medium text-ink">No captured documents match this question</p>
                        <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-secondary">
                          That may mean the topic is outside the current coverage (examinations, fees, revaluation,
                          results and general policy), or no source has published it yet. CampusIntel does not fill the
                          gap with a generated answer.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* How answers will work */}
            <section className="mt-14 border-t border-line pt-8">
              <SectionHeading title="What a complete answer will include" description="The response contract for a connected answer service." />
              <div className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                {[
                  "A concise answer to the question asked",
                  "Source citations with document links",
                  "Relevant publication and effective dates",
                  "Eligibility reasoning with matched conditions",
                  "Any missing information that blocks a conclusion",
                  "Clear, specific next steps",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 border-b border-line py-2.5">
                    <BookOpen size={12} className="mt-1 shrink-0 text-faint" />
                    <p className="text-[12px] leading-relaxed text-secondary">{item}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="card p-5">
              <p className="text-[12px] font-medium text-ink">Service status</p>
              <div className="mt-3 space-y-2.5 text-[11.5px]">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-secondary">Document retrieval</span>
                  <span className="text-success">Connected</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-secondary">Answer generation</span>
                  <span className={config?.llm_configured ? "text-success" : "text-warning"}>
                    {config?.llm_configured ? "Connected · local model" : "Evidence only"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-secondary">Eligibility reasoning</span>
                  <span className="text-warning">Rules only</span>
                </div>
              </div>
              <p className="mt-3 border-t border-line pt-3 text-[10.5px] leading-relaxed text-faint">
                Retrieval covers {circulars.length} captured notice{circulars.length === 1 ? "" : "s"}. No external
                knowledge base is queried.
              </p>
            </div>

            <div className="rounded-card border border-line bg-wash p-5">
              <Sparkle size={14} className="text-cobalt" />
              <p className="mt-2.5 text-[12px] font-medium text-ink">Why not just use a chatbot?</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-secondary">
                Academic guidance has consequences. A confident-sounding answer that is not grounded in an official
                document is worse than no answer, so this page shows evidence rather than speculation.
              </p>
            </div>

            {matches.length > 0 && asked && (
              <div className="card p-5">
                <p className="text-[12px] font-medium text-ink">Sources in this result</p>
                <ul className="mt-2 space-y-2">
                  {Array.from(new Set(matches.map((item) => item.source_name || item.institution || "Unknown source"))).map(
                    (source) => (
                      <li key={source} className="flex items-start gap-2 text-[11px] leading-relaxed text-secondary">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-faint" /> {source}
                      </li>
                    ),
                  )}
                </ul>
                <p className="mt-3 border-t border-line pt-3 text-[10px] text-faint">
                  Citations are direct links to the issuing authority, not summaries.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
