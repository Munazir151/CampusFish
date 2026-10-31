"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, Check, GraduationCap, Loader2, Sparkle, UserRound } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { Badge, Button, ButtonLink, Container, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { LOCAL_USER_KEY, readExtras, writeExtras, type ProfileExtras } from "@/lib/student";
import { INSTITUTION_TYPES, SEMESTERS, type User } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const { push } = useToast();

  const [existing, setExisting] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    institution: "",
    branch: "",
    semester: "",
    scheme: "",
    institutionType: "",
    programme: "",
    admissionYear: "",
  });

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCAL_USER_KEY);
    if (!stored) {
      setChecking(false);
      return;
    }
    api
      .me(stored)
      .then((user) => setExisting(user))
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const user = await api.createUser({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        institution: form.institution.trim() || undefined,
        branch: form.branch.trim() || undefined,
        semester: form.semester || undefined,
        scheme: form.scheme.trim() || undefined,
      });

      const extras: ProfileExtras = {
        ...readExtras(),
        institutionType: form.institutionType || undefined,
        programme: form.programme.trim() || undefined,
        admissionYear: form.admissionYear || undefined,
      };
      writeExtras(extras);
      window.localStorage.setItem(LOCAL_USER_KEY, user.id);

      push("Profile created. Your briefing is ready.", "success");
      router.push("/overview");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not create your profile", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <Container className="py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <Badge tone="cobalt">
              <Sparkle size={11} /> Academic profile
            </Badge>
            <h1 className="mt-5 font-serif text-[36px] leading-[1.08] tracking-[-0.025em] sm:text-[44px]">
              Tell CampusFish what applies to you.
            </h1>
            <p className="mt-4 max-w-md text-[14.5px] leading-[1.75] text-secondary">
              Notices are matched against your institution, programme, semester and scheme. You can change any of this
              later, and nothing is assumed on your behalf.
            </p>

            {existing ? (
              <div className="card mt-8 p-6">
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                  <Check size={14} className="text-success" /> A profile already exists
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-secondary">
                  {existing.name}
                  {existing.institution ? ` · ${existing.institution}` : ""}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink href="/overview" variant="primary">
                    Go to your briefing
                  </ButtonLink>
                  <ButtonLink href="/profile" variant="secondary">
                    Edit profile
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="card mt-8 p-5 sm:p-7">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Full name" htmlFor="name">
                      <div className="relative">
                        <UserRound size={14} className="pointer-events-none absolute left-3.5 top-3 text-faint" />
                        <input
                          id="name"
                          required
                          value={form.name}
                          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                          className="input pl-9"
                          placeholder="Your name"
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="sm:col-span-2">
                    <Field label="Institution" htmlFor="institution" hint="Your college or university as it appears officially.">
                      <div className="relative">
                        <Building2 size={14} className="pointer-events-none absolute left-3.5 top-3 text-faint" />
                        <input
                          id="institution"
                          value={form.institution}
                          onChange={(event) => setForm((prev) => ({ ...prev, institution: event.target.value }))}
                          className="input pl-9"
                          placeholder="Institution name"
                        />
                      </div>
                    </Field>
                  </div>

                  <Field label="Institution type" htmlFor="institution-type">
                    <select
                      id="institution-type"
                      value={form.institutionType}
                      onChange={(event) => setForm((prev) => ({ ...prev, institutionType: event.target.value }))}
                      className="input"
                    >
                      <option value="">Not specified</option>
                      {INSTITUTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Programme" htmlFor="programme">
                    <input
                      id="programme"
                      value={form.programme}
                      onChange={(event) => setForm((prev) => ({ ...prev, programme: event.target.value }))}
                      className="input"
                      placeholder="e.g. B.E."
                    />
                  </Field>

                  <Field label="Branch or specialisation" htmlFor="branch">
                    <input
                      id="branch"
                      value={form.branch}
                      onChange={(event) => setForm((prev) => ({ ...prev, branch: event.target.value }))}
                      className="input"
                      placeholder="e.g. Computer Science"
                    />
                  </Field>

                  <Field label="Semester" htmlFor="semester">
                    <select
                      id="semester"
                      value={form.semester}
                      onChange={(event) => setForm((prev) => ({ ...prev, semester: event.target.value }))}
                      className="input"
                    >
                      <option value="">Not specified</option>
                      {SEMESTERS.map((semester) => (
                        <option key={semester} value={semester}>
                          Semester {semester}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Scheme" htmlFor="scheme">
                    <input
                      id="scheme"
                      value={form.scheme}
                      onChange={(event) => setForm((prev) => ({ ...prev, scheme: event.target.value }))}
                      className="input"
                      placeholder="e.g. 2022"
                    />
                  </Field>

                  <Field label="Admission year" htmlFor="admission-year">
                    <select
                      id="admission-year"
                      value={form.admissionYear}
                      onChange={(event) => setForm((prev) => ({ ...prev, admissionYear: event.target.value }))}
                      className="input"
                    >
                      <option value="">Not specified</option>
                      {Array.from({ length: 9 }, (_, index) => String(new Date().getFullYear() - 8 + index)).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Button type="submit" variant="primary" className="mt-5 w-full" disabled={saving || !form.name.trim()}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  {saving ? "Creating profile…" : "Create my profile"}
                </Button>
                <p className="mt-3 text-center text-[10.5px] leading-relaxed text-faint">
                  No password required. Institution type, programme and admission year stay on this device in this
                  build; everything else is stored by the backend.
                </p>
              </form>
            )}

            {checking && <p className="mt-6 text-[11.5px] text-faint">Checking for an existing profile…</p>}
          </div>

          <aside className="space-y-4 lg:pt-16">
            <div className="card p-6">
              <div className="flex items-center gap-2 text-[12px] font-medium text-ink">
                <GraduationCap size={14} /> What happens next
              </div>
              <ol className="mt-4 space-y-4">
                {[
                  ["Your briefing", "Notices ranked by relevance to your profile and how soon they close."],
                  ["Applicability", "Each notice shows the audience it was issued for, compared with your details."],
                  ["Research", "You decide which official sources CampusFish reads and when it runs."],
                ].map(([title, body], index) => (
                  <li key={title} className="flex gap-3">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-cobalt/20 bg-cobalt/5 font-mono text-[9.5px] text-cobalt">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-[12.5px] font-medium text-ink">{title}</p>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-secondary">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-card border border-line bg-wash p-6">
              <p className="text-[12px] font-medium text-ink">Academic integrity</p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-secondary">
                CampusFish only reports what an official document says. If a deadline, effective date or eligibility
                condition is unknown, it is shown as not specified — never guessed.
              </p>
              <Link href="/" className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-ink hover:text-secondary">
                Back to overview <ArrowRight size={11} />
              </Link>
            </div>
          </aside>
        </div>
      </Container>
    </AppShell>
  );
}
