import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  FileSearch,
  Fingerprint,
  GitCompare,
  Globe2,
  GraduationCap,
  Layers,
  MessagesSquare,
  ScanSearch,
  ShieldCheck,
  Sparkle,
  UserCheck,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { DotPattern } from "@/components/ui/dot-pattern";
import { Badge, ButtonLink, Container, SectionHeading } from "@/components/ui";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/types";

const capabilities = [
  {
    icon: ScanSearch,
    title: "Continuous source research",
    body: "Web agents open official university and college pages, paginate through notice lists and read the documents — no brittle scrapers to maintain.",
    status: "Available now",
  },
  {
    icon: Layers,
    title: "Structured extraction",
    body: "Every notice is classified, summarised and read for deadlines, audience, branch, semester and scheme, with the original source URL kept intact.",
    status: "Available now",
  },
  {
    icon: GitCompare,
    title: "Change intelligence",
    body: "When a regulation is re-issued, CampusFish compares the previous and current document and reports added, removed and modified provisions.",
    status: "Comparison not connected yet",
  },
  {
    icon: UserCheck,
    title: "Personalised applicability",
    body: "Your institution, programme, semester and scheme are matched against the audience stated in each notice — with missing information shown, never assumed.",
    status: "Available now",
  },
  {
    icon: CalendarClock,
    title: "Deadline intelligence",
    body: "Publication date, discovery date and application deadline are kept separate, so a page that still exists is never mistaken for an open application.",
    status: "Available now",
  },
  {
    icon: MessagesSquare,
    title: "Ask CampusFish",
    body: "Ask a question in plain language and receive an answer grounded in official documents, with citations and next steps.",
    status: "Available now",
  },
];

const steps = [
  {
    number: "01",
    title: "Research",
    body: "CampusFish visits each source you connect and reads the latest circulars and notice pages exactly as a student would.",
  },
  {
    number: "02",
    title: "Understand",
    body: "Documents are classified, summarised and read for dates, audience and required action. Unreadable or missing documents are reported, not guessed.",
  },
  {
    number: "03",
    title: "Personalise",
    body: "Your academic profile decides what surfaces first. Every item shows why it is relevant and where it came from.",
  },
];

const statuses = [
  { label: "Applies to you", tone: "success" as const, body: "The audience stated in the notice matches your profile." },
  { label: "Potentially applies", tone: "warning" as const, body: "Some requirements match, but information is missing." },
  { label: "Does not apply", tone: "neutral" as const, body: "A stated condition, such as semester or scheme, differs." },
  { label: "Unable to determine", tone: "neutral" as const, body: "The source does not state enough to decide." },
];

export default function LandingPage() {
  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <DotPattern
          width={24}
          height={24}
          cx={1}
          cy={1}
          cr={1}
          className="fill-cobalt/[0.16] [mask-image:radial-gradient(620px_circle_at_26%_36%,white,transparent)]"
        />
        <Container className="relative z-10 grid gap-14 py-16 sm:py-24 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-10">
          <div className="animate-fade-up">
            <span className="chip-cobalt">
              <Sparkle size={11} /> Autonomous academic intelligence
            </span>
            <h1 className="mt-6 font-serif text-[44px] leading-[1.03] tracking-[-0.03em] text-ink sm:text-[60px]">
              Your academic world.
              <br />
              <span className="text-cobalt">One intelligence platform.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[16px] leading-[1.7] text-secondary">
              Discover opportunities, understand academic changes and stay ahead of everything that matters to your
              education.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/overview" variant="primary" size="lg">
                Explore CampusFish <ArrowRight size={15} />
              </ButtonLink>
              <ButtonLink href="#how-it-works" variant="secondary" size="lg">
                How it works
              </ButtonLink>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={13} /> Official sources only
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileSearch size={13} /> Source link on every notice
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Fingerprint size={13} /> Profile-based, not a notice board
              </span>
            </div>
          </div>

          <div className="relative">
            <p className="mb-3 text-right text-[11px] text-faint">Interface preview · sample content</p>
            <div className="card overflow-hidden shadow-[0_40px_80px_-60px_rgba(3,4,7,0.45)]">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-mist" />
                <span className="h-2 w-2 rounded-full bg-mist" />
                <span className="h-2 w-2 rounded-full bg-mist" />
                <span className="ml-2 rounded-md bg-mist px-2 py-0.5 font-mono text-[10px] text-faint">
                  campusfish / overview
                </span>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-medium text-ink">Good morning, Aisha</p>
                    <p className="mt-0.5 text-[11px] text-secondary">Here is what matters in your academic world.</p>
                  </div>
                  <span className="chip">Semester 5</span>
                </div>

                <div className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line">
                  {[
                    ["Notices", "42"],
                    ["Deadlines", "6"],
                    ["For you", "9"],
                  ].map(([label, value]) => (
                    <div key={label} className="px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.1em] text-faint">{label}</p>
                      <p className="mt-0.5 text-[16px] font-medium text-ink">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-line p-3.5">
                  <div className="flex items-center gap-1.5">
                    <span className="chip">Fees &amp; applications</span>
                    <span className="chip-success">Applies to you</span>
                  </div>
                  <p className="mt-2 text-[12px] font-medium leading-snug text-ink">
                    Examination registration and fee payment — B.E. 5th semester
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-secondary">
                    Deadline 12 Nov · Pay the prescribed fee before the last date.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-faint">Upcoming deadlines</p>
                  {[
                    ["12 Nov", "Examination registration", "Due soon"],
                    ["28 Nov", "Revaluation window closes", "Upcoming"],
                  ].map(([date, title, state]) => (
                    <div key={title} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                      <span className="w-12 text-[10.5px] font-medium text-secondary">{date}</span>
                      <span className="flex-1 truncate text-[11.5px] text-ink">{title}</span>
                      <span className="text-[10px] text-faint">{state}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-b border-line">
        <Container className="py-16 sm:py-24">
          <SectionHeading
            title="How CampusFish works"
            description="Three steps, applied continuously to every source you connect."
            action={<span className="eyebrow">The engine</span>}
          />
          <div className="mt-10 grid gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="bg-paper p-7">
                <span className="inline-flex items-center gap-2 font-mono text-[11px] text-cobalt">
                  <span className="h-1 w-1 rounded-full bg-acid" />
                  {step.number}
                </span>
                <h3 className="mt-4 text-[16px] font-medium tracking-[-0.01em]">{step.title}</h3>
                <p className="mt-2 text-[13.5px] leading-[1.7] text-secondary">{step.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Capabilities */}
      <section className="border-b border-line bg-wash">
        <Container className="py-16 sm:py-24">
          <SectionHeading
            title="Academic intelligence capabilities"
            description="Each capability states its real status in this build. Nothing here pretends to be connected when it is not."
            action={<span className="eyebrow">Capabilities</span>}
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, body, status }) => (
              <div key={title} className="card flex flex-col p-6">
                <Icon size={18} className="text-cobalt" strokeWidth={1.6} />
                <h3 className="mt-5 text-[15px] font-medium tracking-[-0.01em]">{title}</h3>
                <p className="mt-2 flex-1 text-[13px] leading-[1.7] text-secondary">{body}</p>
                <p className="mt-5 flex items-center gap-1.5 border-t border-line pt-3 text-[11px] text-faint">
                  {status === "Available now" ? (
                    <>
                      <Check size={12} className="text-success" /> {status}
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full border border-faint" /> {status}
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Discover */}
      <section className="border-b border-line">
        <Container className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <span className="eyebrow">Discover</span>
            <h2 className="mt-3 font-serif text-[34px] leading-[1.1] tracking-[-0.02em] sm:text-[42px]">
              Discover what you missed.
            </h2>
            <p className="mt-4 max-w-md text-[14.5px] leading-[1.75] text-secondary">
              Scholarships, examination notices, revaluation windows and policy revisions are published in places
              nobody checks daily. CampusFish reads them and surfaces what is relevant to your programme.
            </p>
            <p className="mt-6 flex items-start gap-2 text-[12.5px] leading-relaxed text-secondary">
              <Globe2 size={14} className="mt-0.5 shrink-0 text-faint" />
              Coverage spans scholarships, education loans, internships, jobs and placements, research programmes,
              examinations and more. A category with no captured notices stays empty rather than being filled with
              invented content.
            </p>
            <ButtonLink href="/discover" variant="secondary" className="mt-7">
              Open Discover <ArrowRight size={14} />
            </ButtonLink>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium text-ink">Information types</p>
              <span className="text-[11px] text-faint">{CATEGORY_ORDER.length} tracked</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {CATEGORY_ORDER.slice(0, 8).map((key) => (
                <div key={key} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
                  <span className="text-[12.5px] text-ink">{CATEGORY_META[key].label}</span>
                  <span className="flex items-center gap-1 text-[10px] text-success">
                    <Check size={11} /> Tracked
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-faint">
              + {CATEGORY_ORDER.length - 8} more types, including results, re-evaluation, student welfare and academic
              policy. Empty categories stay empty rather than being filled with invented notices.
            </p>
          </div>
        </Container>
      </section>

      {/* Changes */}
      <section className="border-b border-line bg-ink text-white">
        <Container className="grid gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-acid">Change intelligence</span>
            <h2 className="mt-3 font-serif text-[34px] leading-[1.1] tracking-[-0.02em] text-white sm:text-[42px]">
              Know what changed.
              <br />
              Not just what exists.
            </h2>
            <p className="mt-5 max-w-md text-[14.5px] leading-[1.75] text-white/65">
              A regulation that was revised last week is different information from the one you read last semester.
              CampusFish keeps previous and current documents side by side when a re-issued version is captured, and
              says so plainly when no earlier version exists.
            </p>
            <ButtonLink href="/changes" variant="secondary" className="mt-8 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              Open Changes <ArrowRight size={14} />
            </ButtonLink>
          </div>

          <div className="rounded-card border border-white/12 bg-white/[0.04] p-6">
            <p className="text-[11px] text-white/45">Comparison preview · sample content</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-white/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Previous · 12 Jul 2026</p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-white/70 line-through decoration-white/30">
                  Revaluation applications must be submitted within 15 days of result publication.
                </p>
              </div>
              <div className="rounded-xl border border-white/20 p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Current · 02 Nov 2026</p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-white">
                  Revaluation applications must be submitted within 10 days of result publication.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["What changed", "Window reduced from 15 to 10 days"],
                  ["Who is affected", "Students with results published after 01 Nov"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-white/40">{label}</p>
                    <p className="mt-1 text-[11.5px] leading-snug text-white/75">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Eligibility */}
      <section className="border-b border-line">
        <Container className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_0.95fr] lg:items-center lg:gap-16">
          <div>
            <span className="eyebrow">Personalised eligibility</span>
            <h2 className="mt-3 font-serif text-[34px] leading-[1.1] tracking-[-0.02em] sm:text-[42px]">
              Understand what applies to you.
            </h2>
            <p className="mt-4 max-w-md text-[14.5px] leading-[1.75] text-secondary">
              CampusFish separates three questions that are often merged: does the rule apply to your institution,
              do you qualify individually, and is the opportunity still open? When a mandatory condition is unknown,
              it says so instead of declaring you eligible.
            </p>
            <ButtonLink href="/eligibility" variant="secondary" className="mt-7">
              Open Eligibility <ArrowRight size={14} />
            </ButtonLink>
          </div>

          <div className="space-y-2.5">
            {statuses.map((item) => (
              <div key={item.label} className="card flex items-start gap-4 p-4">
                <Badge tone={item.tone}>{item.label}</Badge>
                <p className="flex-1 text-[12.5px] leading-relaxed text-secondary">{item.body}</p>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-faint">Status labels shown as they appear in the product.</p>
          </div>
        </Container>
      </section>

      {/* Research */}
      <section className="border-b border-line bg-wash">
        <Container className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium text-ink">Research activity</p>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-secondary">
                <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-cobalt" /> Preview
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {[
                ["University examination section", "Reading circular list", "Completed"],
                ["Affiliated college notices", "Extracting PDF documents", "Researching"],
                ["Scholarship portal", "Source unreachable", "Failed"],
              ].map(([name, task, state]) => (
                <div key={name} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink">{name}</p>
                    <p className="truncate text-[11px] text-secondary">{task}</p>
                  </div>
                  <span className="text-[10px] text-faint">{state}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-faint">
              Illustrative states. The Research page shows real scan statuses from connected sources only.
            </p>
          </div>

          <div>
            <span className="eyebrow">Research</span>
            <h2 className="mt-3 font-serif text-[34px] leading-[1.1] tracking-[-0.02em] sm:text-[42px]">
              Research official sources.
            </h2>
            <p className="mt-4 max-w-md text-[14.5px] leading-[1.75] text-secondary">
              CampusFish reads the websites institutions actually publish on. You can see which sources are being
              researched, when they were last reached, and which ones failed — because a quiet feed is not the same
              as an empty one.
            </p>
            <ButtonLink href="/research" variant="secondary" className="mt-7">
              See research activity <ArrowRight size={14} />
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <section>
        <Container className="py-20 text-center sm:py-28">
          <GraduationCap size={22} className="mx-auto text-cobalt" strokeWidth={1.5} />
          <h2 className="mx-auto mt-6 max-w-2xl font-serif text-[36px] leading-[1.08] tracking-[-0.025em] sm:text-[48px]">
            Know what changed. Discover what you missed. Understand what applies to you.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[14.5px] leading-relaxed text-secondary">
            Set your institution, programme and semester once. CampusFish organises everything else around it.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/onboarding" variant="primary" size="lg">
              Set up your academic profile <ArrowRight size={15} />
            </ButtonLink>
            <ButtonLink href="/overview" variant="secondary" size="lg">
              Explore the platform
            </ButtonLink>
          </div>
          <p className="mt-6 text-[11.5px] text-faint">
            No password required · Your profile is used only to match notices
          </p>
        </Container>
      </section>
    </AppShell>
  );
}
