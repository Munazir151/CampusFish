"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Loader2, Send, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import {
  Badge,
  Button,
  ButtonLink,
  FactRow,
  Field,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { api } from "@/lib/api";
import {
  LOCAL_USER_KEY,
  useProfileExtras,
  useStudent,
  type ProfileExtras,
} from "@/lib/student";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  DEFAULT_ALERT_CATEGORIES,
  DEFAULT_NOTIFICATION_PREFERENCES,
  INSTITUTION_TYPES,
  SEMESTERS,
  type AppConfig,
  type Category,
  type NotificationPreferences,
} from "@/lib/types";

const YEARS = Array.from({ length: 9 }, (_, index) => String(new Date().getFullYear() - 5 + index));

export default function ProfilePage() {
  const { user, loading, setUser, reload } = useStudent();
  const { extras, save } = useProfileExtras();
  const { push } = useToast();

  const [form, setForm] = useState({
    name: "",
    email: "",
    institution: "",
    branch: "",
    semester: "",
    scheme: "",
    annual_income: "",
    social_category: "",
    domicile: "",
  });
  const [extrasForm, setExtrasForm] = useState<ProfileExtras>({});
  const [prefForm, setPrefForm] = useState<NotificationPreferences>({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    categories: [...DEFAULT_ALERT_CATEGORIES],
  });
  const [saving, setSaving] = useState(false);
  const [savingExtras, setSavingExtras] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || "",
      email: user.email || "",
      institution: user.institution || "",
      branch: user.branch || "",
      semester: user.semester || "",
      scheme: user.scheme || "",
      annual_income: user.annual_income ? String(user.annual_income) : "",
      social_category: user.social_category || "",
      domicile: user.domicile || "",
    });
  }, [user]);

  useEffect(() => {
    setExtrasForm(extras);
  }, [extras]);

  useEffect(() => {
    if (!user) return;
    const stored = user.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
    setPrefForm({
      ...stored,
      categories: [...(stored.categories ?? DEFAULT_ALERT_CATEGORIES)],
    });
  }, [user]);

  useEffect(() => {
    api.config().then(setConfig).catch(() => undefined);
  }, []);

  const telegramLink = useMemo(() => {
    if (!user || !config?.telegram_bot_username) return null;
    return `https://t.me/${config.telegram_bot_username}?start=${user.id}`;
  }, [user, config]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (user) {
        const updated = await api.updateUser(user.id, {
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          institution: form.institution.trim() || undefined,
          branch: form.branch.trim() || undefined,
          semester: form.semester.trim() || undefined,
          scheme: form.scheme.trim() || undefined,
          annual_income: form.annual_income.trim() ? Number(form.annual_income) : undefined,
          social_category: form.social_category.trim() || undefined,
          domicile: form.domicile.trim() || undefined,
        });
        setUser(updated);
        push("Academic profile saved", "success");
      } else {
        const created = await api.createUser({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          institution: form.institution.trim() || undefined,
          branch: form.branch.trim() || undefined,
          semester: form.semester.trim() || undefined,
          scheme: form.scheme.trim() || undefined,
          annual_income: form.annual_income.trim() ? Number(form.annual_income) : undefined,
          social_category: form.social_category.trim() || undefined,
          domicile: form.domicile.trim() || undefined,
        });
        window.localStorage.setItem(LOCAL_USER_KEY, created.id);
        setUser(created);
        push("Profile created", "success");
      }
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not save your profile", "error");
    } finally {
      setSaving(false);
    }
  }

  function saveExtras(event: React.FormEvent) {
    event.preventDefault();
    setSavingExtras(true);
    save(extrasForm);
    setSavingExtras(false);
    push("Institution settings saved on this device", "success");
  }

  function toggleAlertCategory(category: Category) {
    setPrefForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((item) => item !== category)
        : [...prev.categories, category],
    }));
  }

  async function saveAlertPreferences() {
    if (!user) return;
    setSavingPrefs(true);
    try {
      const updated = await api.updateUser(user.id, { preferences: prefForm });
      setUser(updated);
      push("Alert preferences saved", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not save alert preferences", "error");
    } finally {
      setSavingPrefs(false);
    }
  }

  async function sendTestAlert() {
    if (!user) return;
    setTestingTelegram(true);
    try {
      await api.testTelegram(user.id);
      push("Test alert sent to Telegram", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not send the test alert", "error");
    } finally {
      setTestingTelegram(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-page px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <PageHeader
          eyebrow="Student profile"
          title={user ? user.name : "Set up your academic profile"}
          description="Your profile is used only to decide which official notices apply to you. Optional information is requested when a notice actually needs it."
          actions={
            user ? (
              <Badge tone="success">
                <Check size={11} /> Profile on record
              </Badge>
            ) : (
              <Badge tone="warning">No profile yet</Badge>
            )
          }
        />

        {!user && !loading && (
          <p className="mt-5 rounded-2xl bg-wash px-4 py-3 text-[12px] leading-relaxed text-secondary">
            You can create a profile here, or use the guided{" "}
            <Link href="/onboarding" className="link">
              setup
            </Link>
            .
          </p>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-14">
          <div className="min-w-0 space-y-12">
            {/* Academic profile */}
            <section id="academic">
              <SectionHeading
                title="Academic profile"
                description="Stored by CampusFish and used for applicability checks."
              />
              <form onSubmit={saveProfile} className="card mt-4 p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="name">
                    <input
                      id="name"
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      className="input"
                      placeholder="Your name"
                      required
                    />
                  </Field>
                  <Field label="Email (optional)" htmlFor="email" hint="Used only for notifications if enabled.">
                    <input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="input"
                      placeholder="you@student.edu"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Institution" htmlFor="institution" hint="Use the full official name of your college or university.">
                      <input
                        id="institution"
                        value={form.institution}
                        onChange={(event) => setForm((prev) => ({ ...prev, institution: event.target.value }))}
                        className="input"
                        placeholder="Institution name"
                      />
                    </Field>
                  </div>
                  <Field label="Branch or specialisation" htmlFor="branch">
                    <input
                      id="branch"
                      value={form.branch}
                      onChange={(event) => setForm((prev) => ({ ...prev, branch: event.target.value }))}
                      className="input"
                      placeholder="e.g. Computer Science"
                    />
                  </Field>
                  <Field label="Semester or year" htmlFor="semester">
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
                  <Field
                    label="Academic scheme"
                    htmlFor="scheme"
                    hint="The scheme or regulation year your batch is admitted under."
                  >
                    <input
                      id="scheme"
                      value={form.scheme}
                      onChange={(event) => setForm((prev) => ({ ...prev, scheme: event.target.value }))}
                      className="input"
                      placeholder="e.g. 2022"
                    />
                  </Field>
                  <Field
                    label="Annual family income (optional)"
                    htmlFor="annual-income"
                    hint="Used to check scholarship and loan income limits. Stored with your profile, never shared."
                  >
                    <input
                      id="annual-income"
                      type="number"
                      min="0"
                      step="1000"
                      value={form.annual_income}
                      onChange={(event) => setForm((prev) => ({ ...prev, annual_income: event.target.value }))}
                      className="input"
                      placeholder="e.g. 250000"
                    />
                  </Field>
                  <Field label="Social category (optional)" htmlFor="social-category">
                    <select
                      id="social-category"
                      value={form.social_category}
                      onChange={(event) => setForm((prev) => ({ ...prev, social_category: event.target.value }))}
                      className="input"
                    >
                      <option value="">Not specified</option>
                      <option value="General">General</option>
                      <option value="OBC">OBC</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                      <option value="EWS">EWS</option>
                      <option value="Minority">Minority</option>
                      <option value="PwD">PwD</option>
                    </select>
                  </Field>
                  <Field label="Domicile state (optional)" htmlFor="domicile" hint="Only used when a notice restricts eligibility by state.">
                    <input
                      id="domicile"
                      value={form.domicile}
                      onChange={(event) => setForm((prev) => ({ ...prev, domicile: event.target.value }))}
                      className="input"
                      placeholder="e.g. Karnataka"
                    />
                  </Field>
                  <Field label="Programme" htmlFor="programme" hint="Optional. Requested when a notice depends on it.">
                    <input
                      id="programme"
                      value={extrasForm.programme || ""}
                      onChange={(event) => setExtrasForm((prev) => ({ ...prev, programme: event.target.value }))}
                      className="input"
                      placeholder="e.g. B.E. / B.Tech / B.Sc"
                    />
                  </Field>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <p className="text-[11px] text-faint">
                    {user ? `Account ID ${user.id.slice(0, 8)}…` : "No password is required."}
                  </p>
                  <Button type="submit" variant="primary" disabled={saving || !form.name.trim()}>
                    {saving && <Loader2 size={13} className="animate-spin" />}
                    {user ? "Save changes" : "Create profile"}
                  </Button>
                </div>
              </form>
            </section>

            {/* Institution settings */}
            <section id="institution">
              <SectionHeading
                title="Institution settings"
                description="Institutions differ. These details decide which rules can be interpreted against you."
                action={<Badge tone="quiet">Stored on this device</Badge>}
              />
              <form onSubmit={saveExtras} className="card mt-4 p-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Institution type" htmlFor="institution-type">
                    <select
                      id="institution-type"
                      value={extrasForm.institutionType || ""}
                      onChange={(event) =>
                        setExtrasForm((prev) => ({ ...prev, institutionType: event.target.value }))
                      }
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
                  <Field
                    label="Affiliating university"
                    htmlFor="affiliation"
                    hint="Where applicable. Leave empty for autonomous institutions."
                  >
                    <input
                      id="affiliation"
                      value={extrasForm.affiliation || ""}
                      onChange={(event) => setExtrasForm((prev) => ({ ...prev, affiliation: event.target.value }))}
                      className="input"
                      placeholder="Affiliating university"
                    />
                  </Field>
                  <Field label="Admission year" htmlFor="admission-year">
                    <select
                      id="admission-year"
                      value={extrasForm.admissionYear || ""}
                      onChange={(event) => setExtrasForm((prev) => ({ ...prev, admissionYear: event.target.value }))}
                      className="input"
                    >
                      <option value="">Not specified</option>
                      {YEARS.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Expected graduation year" htmlFor="graduation-year">
                    <select
                      id="graduation-year"
                      value={extrasForm.graduationYear || ""}
                      onChange={(event) =>
                        setExtrasForm((prev) => ({ ...prev, graduationYear: event.target.value }))
                      }
                      className="input"
                    >
                      <option value="">Not specified</option>
                      {YEARS.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <p className="max-w-md text-[11px] leading-relaxed text-faint">
                    The backend does not yet store these fields, so they stay in this browser. They are labelled
                    device-only rather than pretending to be synced.
                  </p>
                  <Button type="submit" variant="secondary" disabled={savingExtras}>
                    Save institution settings
                  </Button>
                </div>
              </form>
            </section>

            {/* Preferences */}
            <section id="preferences">
              <SectionHeading
                title="Preferences"
                description="How CampusFish reaches you, and optional information used only when a notice requires it."
              />
              <div className="card mt-4 p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[12.5px] font-medium text-ink">Alert delivery</p>
                    <p className="mt-1 max-w-md text-[11.5px] leading-relaxed text-secondary">
                      {user?.telegram_chat_id
                        ? "Telegram is linked. Personalised alerts are delivered to your chat."
                        : config?.telegram_configured
                          ? "Telegram is available on this deployment but not linked to your profile."
                          : "Telegram is not configured on this deployment, so alerts remain in the dashboard."}
                    </p>
                  </div>
                  {telegramLink && !user?.telegram_chat_id ? (
                    <a href={telegramLink} target="_blank" rel="noreferrer noopener" className="btn-secondary btn-sm">
                      <Send size={12} /> Connect Telegram
                    </a>
                  ) : (
                    <Badge tone={user?.telegram_chat_id ? "success" : "neutral"}>
                      {user?.telegram_chat_id ? "Linked" : config?.telegram_configured ? "Available" : "Unavailable"}
                    </Badge>
                  )}
                </div>

                <div className="mt-5 border-t border-line pt-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[12.5px] font-medium text-ink">What reaches your Telegram</p>
                      <p className="mt-1 max-w-lg text-[11.5px] leading-relaxed text-secondary">
                        Only notices that match these rules create alerts. Everything else is still captured and stays
                        in Discover, without interrupting you. Telegram messages are held briefly so the refined
                        classification, amount and eligibility conditions are used instead of the first rough pass.
                      </p>
                    </div>
                    <Badge tone={prefForm.categories.length ? "cobalt" : "warning"}>
                      {prefForm.categories.length
                        ? `${prefForm.categories.length} types selected`
                        : "Alerts paused"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-x-5 gap-y-2 sm:grid-cols-2">
                    {CATEGORY_ORDER.map((category) => (
                      <label
                        key={category}
                        className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 text-[12px] text-secondary hover:bg-wash"
                      >
                        <input
                          type="checkbox"
                          checked={prefForm.categories.includes(category)}
                          onChange={() => toggleAlertCategory(category)}
                          className="mt-0.5 h-3.5 w-3.5 accent-[#1558C9]"
                        />
                        <span>
                          <span className="font-medium text-ink">{CATEGORY_META[category].label}</span>
                          <span className="block text-[10.5px] leading-snug text-faint">
                            {CATEGORY_META[category].description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Minimum priority" htmlFor="min-urgency">
                      <select
                        id="min-urgency"
                        value={prefForm.min_urgency}
                        onChange={(event) =>
                          setPrefForm((prev) => ({
                            ...prev,
                            min_urgency: event.target.value as NotificationPreferences["min_urgency"],
                          }))
                        }
                        className="input"
                      >
                        <option value="HIGH">High priority only</option>
                        <option value="MEDIUM">Medium and high</option>
                        <option value="LOW">All priorities</option>
                      </select>
                    </Field>
                    <Field label="Deadline window" htmlFor="deadline-window">
                      <select
                        id="deadline-window"
                        value={prefForm.deadline_within_days ?? "any"}
                        onChange={(event) =>
                          setPrefForm((prev) => ({
                            ...prev,
                            deadline_within_days:
                              event.target.value === "any" ? null : Number(event.target.value),
                          }))
                        }
                        className="input"
                      >
                        <option value="any">Any deadline</option>
                        <option value="7">Within 7 days</option>
                        <option value="30">Within 30 days</option>
                        <option value="90">Within 90 days</option>
                      </select>
                    </Field>
                  </div>

                  <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[11.5px] leading-relaxed text-secondary">
                    <input
                      type="checkbox"
                      checked={prefForm.include_without_deadline}
                      onChange={(event) =>
                        setPrefForm((prev) => ({
                          ...prev,
                          include_without_deadline: event.target.checked,
                        }))
                      }
                      className="mt-0.5 h-3.5 w-3.5 accent-[#1558C9]"
                    />
                    Include opportunities that do not state a deadline (common for internships and jobs).
                  </label>

                  <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-md text-[11px] leading-relaxed text-faint">
                      {prefForm.categories.length === 0
                        ? "No types selected, so no alerts will be created until you choose at least one."
                        : "Category and audience rules are applied before anything is sent."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {user?.telegram_chat_id && (
                        <Button
                          variant="secondary"
                          onClick={() => void sendTestAlert()}
                          disabled={testingTelegram}
                        >
                          {testingTelegram ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                          Send test
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        onClick={() => void saveAlertPreferences()}
                        disabled={!user || savingPrefs}
                      >
                        {savingPrefs && <Loader2 size={13} className="animate-spin" />}
                        Save alert preferences
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-wash p-4">
                  <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink">
                    <ShieldCheck size={13} /> Privacy
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-secondary">
                    Annual income, social category and domicile are optional and stored with your profile so
                    scholarship conditions can be compared. They are never shown to other students, sold, or used to
                    declare eligibility on their own. Leave them blank and CampusFish will say the condition needs
                    checking instead of guessing.
                  </p>
                </div>

                <div className="mt-4 flex justify-end border-t border-line pt-4">
                  <Button onClick={saveExtras} variant="secondary">
                    Save local fields
                  </Button>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="card p-5">
              <p className="text-[12px] font-medium text-ink">What this profile is used for</p>
              <ul className="mt-2.5 space-y-2 text-[11.5px] leading-relaxed text-secondary">
                <li>Matching the audience stated in official notices.</li>
                <li>Ordering your academic briefing by relevance and deadline.</li>
                <li>Explaining why a notice applies or does not apply.</li>
              </ul>
              <div className="mt-4 border-t border-line pt-3">
                <FactRow label="Notices assessed" value="Every captured notice" />
                <FactRow label="Personal data sold" value="Never" />
                <FactRow label="Sign-in" value="Not enabled" />
              </div>
            </div>

            <div className="rounded-card border border-line bg-wash p-5">
              <p className="text-[12px] font-medium text-ink">Institution structure</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-secondary">
                CampusFish does not assume every institution follows the same academic structure. Affiliated colleges,
                autonomous colleges and universities can each state their own programme, scheme and autonomy status.
              </p>
              <Link href="/eligibility" className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-cobalt hover:text-cobalt/75">
                See eligibility assessments <ExternalLink size={11} />
              </Link>
            </div>

            {loading && (
              <div className="card p-5">
                <p className="text-[11.5px] text-secondary">Loading profile…</p>
              </div>
            )}

            {!user && !loading && (
              <Button variant="quiet" className="w-full" onClick={() => void reload()}>
                Retry loading profile
              </Button>
            )}

            <ButtonLink href="/research" variant="secondary" className="w-full">
              Manage research sources
            </ButtonLink>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
