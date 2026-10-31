"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { AppliesTo, Circular, User } from "./types";

export const LOCAL_USER_KEY = "nr_user_id";
export const LOCAL_PROFILE_KEY = "ci_profile_extras";
export const PROFILE_EVENT = "ci-profile-updated";

/**
 * Extra profile fields the current backend does not store. They are kept on this
 * device only, and the interface says so wherever they are used.
 */
export interface ProfileExtras {
  institutionType?: string;
  programme?: string;
  affiliation?: string;
  admissionYear?: string;
  graduationYear?: string;
}

export function readExtras(): ProfileExtras {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as ProfileExtras) : {};
  } catch {
    return {};
  }
}

export function writeExtras(extras: ProfileExtras) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(extras));
  window.dispatchEvent(new Event(PROFILE_EVENT));
}

export function useProfileExtras() {
  const [extras, setExtras] = useState<ProfileExtras>({});

  useEffect(() => {
    setExtras(readExtras());
    const sync = () => setExtras(readExtras());
    window.addEventListener(PROFILE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROFILE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((next: ProfileExtras) => {
    writeExtras(next);
    setExtras(next);
  }, []);

  return { extras, save };
}

export function useStudent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(LOCAL_USER_KEY) : null;
      const me = await api.me(stored || undefined);
      setUser(me);
      if (typeof window !== "undefined") window.localStorage.setItem(LOCAL_USER_KEY, me.id);
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : "Could not load your profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { user, loading, error, reload: load, setUser };
}

/* ------------------------------------------------------------ applicability */

export type ApplicabilityStatus = "APPLIES" | "POTENTIALLY_APPLIES" | "DOES_NOT_APPLY" | "UNKNOWN";

export interface Condition {
  label: string;
  expected: string;
  actual: string;
}

export interface Assessment {
  status: ApplicabilityStatus;
  matched: Condition[];
  mismatched: Condition[];
  missing: Condition[];
  /** Short sentence suitable for a card. */
  note: string;
}

export type QualificationStatus = "MEETS" | "CHECK" | "DOES_NOT_MEET" | "UNKNOWN";

export interface QualificationCondition {
  label: string;
  expected: string;
  actual: string;
  state: "match" | "mismatch" | "missing";
}

export interface QualificationAssessment {
  status: QualificationStatus;
  conditions: QualificationCondition[];
  note: string;
}

export const QUALIFICATION_META: Record<
  QualificationStatus,
  { label: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  MEETS: { label: "Conditions match", tone: "success" },
  CHECK: { label: "Check conditions", tone: "warning" },
  DOES_NOT_MEET: { label: "Outside your conditions", tone: "danger" },
  UNKNOWN: { label: "No structured conditions", tone: "neutral" },
};

export function assessQualification(circular: Circular, user: User | null): QualificationAssessment {
  const details = circular.details || {};
  const conditions: QualificationCondition[] = [];

  if (details.income_ceiling) {
    if (!user?.annual_income) {
      conditions.push({
        label: "Family income",
        expected: `Up to ₹${details.income_ceiling.toLocaleString("en-IN")}`,
        actual: "Not in your profile",
        state: "missing",
      });
    } else {
      const within = user.annual_income <= details.income_ceiling;
      conditions.push({
        label: "Family income",
        expected: `Up to ₹${details.income_ceiling.toLocaleString("en-IN")}`,
        actual: `₹${user.annual_income.toLocaleString("en-IN")}`,
        state: within ? "match" : "mismatch",
      });
    }
  }

  const stated = details.categories || [];
  if (stated.length) {
    const actual = user?.social_category?.trim();
    if (!actual) {
      conditions.push({ label: "Social category", expected: stated.join(", "), actual: "Not in your profile", state: "missing" });
    } else {
      conditions.push({
        label: "Social category",
        expected: stated.join(", "),
        actual,
        state: stated.some((value) => normalise(value) === normalise(actual)) ? "match" : "mismatch",
      });
    }
  }

  if (details.domicile) {
    const actual = user?.domicile?.trim();
    if (!actual) {
      conditions.push({ label: "Domicile", expected: details.domicile, actual: "Not in your profile", state: "missing" });
    } else {
      const expected = normalise(details.domicile);
      const candidate = normalise(actual);
      conditions.push({
        label: "Domicile",
        expected: details.domicile,
        actual,
        state:
          details.domicile === "All India" || candidate.includes(expected) || expected.includes(candidate)
            ? "match"
            : "mismatch",
      });
    }
  }

  if (conditions.some((condition) => condition.state === "mismatch")) {
    return { status: "DOES_NOT_MEET", conditions, note: "At least one stated condition conflicts with your profile." };
  }
  if (conditions.some((condition) => condition.state === "missing")) {
    return { status: "CHECK", conditions, note: "Some stated conditions need information from your profile." };
  }
  if (conditions.length) {
    return { status: "MEETS", conditions, note: "The stated income, category and domicile conditions match your profile." };
  }
  return { status: "UNKNOWN", conditions, note: "The notice does not state structured individual conditions." };
}

export const APPLICABILITY_META: Record<
  ApplicabilityStatus,
  { label: string; tone: "success" | "warning" | "neutral" | "danger" }
> = {
  APPLIES: { label: "Applies to you", tone: "success" },
  POTENTIALLY_APPLIES: { label: "Potentially applies", tone: "warning" },
  DOES_NOT_APPLY: { label: "Does not apply", tone: "neutral" },
  UNKNOWN: { label: "Unable to determine", tone: "neutral" },
};

export function normalise(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const ROMAN: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4", V: "5", VI: "6", VII: "7", VIII: "8" };

export function normaliseSemester(value: string): string {
  const cleaned = value.trim().toUpperCase().replace(/[^IVX0-9]/g, "");
  if (ROMAN[cleaned]) return ROMAN[cleaned];
  const digits = cleaned.match(/\d+/);
  return digits ? digits[0] : normalise(value);
}

function valuesMatch(kind: "branches" | "semesters" | "schemes", expected: string, actual: string): boolean {
  if (kind === "semesters") {
    return normaliseSemester(expected) === normaliseSemester(actual);
  }
  const a = normalise(expected);
  const b = normalise(actual);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

const FIELD_LABEL: Record<keyof AppliesTo, string> = {
  branches: "Branch",
  semesters: "Semester",
  schemes: "Scheme",
};

const PROFILE_VALUE: Record<keyof AppliesTo, (user: User) => string | null | undefined> = {
  branches: (user) => user.branch,
  semesters: (user) => user.semester,
  schemes: (user) => user.scheme,
};

export function assessApplicability(circular: Circular, user: User | null): Assessment {
  const appliesTo = circular.applies_to || {};
  const dimensions = (Object.keys(FIELD_LABEL) as (keyof AppliesTo)[]).filter(
    (key) => Array.isArray(appliesTo[key]) && (appliesTo[key] as string[]).length > 0,
  );

  if (!user) {
    return {
      status: "UNKNOWN",
      matched: [],
      mismatched: [],
      missing: dimensions.map((key) => ({
        label: FIELD_LABEL[key],
        expected: (appliesTo[key] as string[]).join(", "),
        actual: "Profile not set",
      })),
      note: "Add your institution and academic profile to see whether this applies to you.",
    };
  }

  if (!dimensions.length) {
    return {
      status: "UNKNOWN",
      matched: [],
      mismatched: [],
      missing: [],
      note: "The source does not state an audience for this notice, so applicability cannot be determined.",
    };
  }

  const matched: Condition[] = [];
  const mismatched: Condition[] = [];
  const missing: Condition[] = [];

  dimensions.forEach((key) => {
    const expected = (appliesTo[key] as string[]) || [];
    const actual = PROFILE_VALUE[key](user);
    if (!actual) {
      missing.push({ label: FIELD_LABEL[key], expected: expected.join(", "), actual: "Not in your profile" });
      return;
    }
    if (expected.some((value) => valuesMatch(key, value, actual))) {
      matched.push({ label: FIELD_LABEL[key], expected: expected.join(", "), actual });
    } else {
      mismatched.push({ label: FIELD_LABEL[key], expected: expected.join(", "), actual });
    }
  });

  if (mismatched.length) {
    return {
      status: "DOES_NOT_APPLY",
      matched,
      mismatched,
      missing,
      note: `Issued for ${mismatched
        .map((condition) => `${condition.label.toLowerCase()} ${condition.expected}`)
        .join(", ")}, which does not match your profile.`,
    };
  }

  if (missing.length) {
    return {
      status: "POTENTIALLY_APPLIES",
      matched,
      mismatched,
      missing,
      note: `You satisfy the stated ${matched.map((c) => c.label.toLowerCase()).join(" and ") || "academic"} requirement, but ${missing
        .map((condition) => condition.label.toLowerCase())
        .join(" and ")} is missing from your profile.`,
    };
  }

  return {
    status: "APPLIES",
    matched,
    mismatched,
    missing,
    note: "The audience stated in the notice matches your academic profile.",
  };
}

/* --------------------------------------------------------------- deadlines */

export type DeadlineState = "CLOSED" | "DUE_SOON" | "UPCOMING" | "UNKNOWN";

export function deadlineState(daysLeft?: number | null): DeadlineState {
  if (daysLeft === null || daysLeft === undefined) return "UNKNOWN";
  if (daysLeft < 0) return "CLOSED";
  if (daysLeft <= 7) return "DUE_SOON";
  return "UPCOMING";
}

export const DEADLINE_META: Record<DeadlineState, { label: string; tone: "danger" | "warning" | "neutral" }> = {
  CLOSED: { label: "Closed", tone: "neutral" },
  DUE_SOON: { label: "Due soon", tone: "danger" },
  UPCOMING: { label: "Upcoming", tone: "warning" },
  UNKNOWN: { label: "No deadline stated", tone: "neutral" },
};

const ASSESSMENT_RANK: Record<ApplicabilityStatus, number> = {
  APPLIES: 0,
  POTENTIALLY_APPLIES: 1,
  UNKNOWN: 2,
  DOES_NOT_APPLY: 3,
};

export function sortForStudent(items: Circular[], user: User | null): Circular[] {
  return [...items].sort((a, b) => {
    const rankA = ASSESSMENT_RANK[assessApplicability(a, user).status];
    const rankB = ASSESSMENT_RANK[assessApplicability(b, user).status];
    if (rankA !== rankB) return rankA - rankB;
    const daysA = a.days_left ?? Number.POSITIVE_INFINITY;
    const daysB = b.days_left ?? Number.POSITIVE_INFINITY;
    if (daysA !== daysB) return daysA - daysB;
    return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
  });
}

export function roomToGrow(field: string | null | undefined): boolean {
  return !field || !field.trim();
}
