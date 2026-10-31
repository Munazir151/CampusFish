export type Category =
  | "EXAM_TIMETABLE"
  | "FEE_OR_FORM_DEADLINE"
  | "MAKEUP_OR_REVALUATION"
  | "RESULT"
  | "SCHOLARSHIP"
  | "EDUCATION_LOAN"
  | "INTERNSHIP"
  | "JOB_OR_PLACEMENT"
  | "COMPETITION"
  | "RESEARCH_PROGRAMME"
  | "STUDENT_WELFARE"
  | "ACADEMIC_POLICY"
  | "HOLIDAY_OR_GENERAL";

export type Urgency = "HIGH" | "MEDIUM" | "LOW";

export interface NotificationPreferences {
  categories: Category[];
  min_urgency: Urgency;
  deadline_within_days: number | null;
  include_without_deadline: boolean;
}

export interface AppliesTo {
  branches?: string[];
  semesters?: string[];
  schemes?: string[];
}

export interface OpportunityDetails {
  amount_text?: string | null;
  amount_value?: number | null;
  income_ceiling?: number | null;
  categories?: string[];
  domicile?: string | null;
  course_level?: string | null;
  eligibility_notes?: string | null;
}

export interface Circular {
  id: string;
  source_id?: string | null;
  source_name?: string | null;
  institution?: string | null;
  title: string;
  published_date?: string | null;
  url?: string | null;
  raw_text?: string | null;
  category: Category;
  category_label?: string;
  summary?: string | null;
  deadline?: string | null;
  applies_to?: AppliesTo | null;
  details?: OpportunityDetails | null;
  urgency: Urgency;
  action_required?: string | null;
  confidence?: string | null;
  detected_at: string;
  days_left?: number | null;
  alert_id?: string;
  channel?: string;
  alert_status?: string;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  institution?: string | null;
  goal?: string | null;
  enabled: number | boolean;
  last_scanned_at?: string | null;
  created_at: string;
}

export interface ScanRun {
  id: string;
  scan_group_id: string;
  source_id?: string | null;
  source_name?: string | null;
  tinyfish_run_id?: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  started_at: string;
  finished_at?: string | null;
  new_items_count: number;
  total_items_count: number;
  error?: string | null;
}

export interface ScanGroup {
  scan_id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL" | "EMPTY";
  new_items_count: number;
  runs: ScanRun[];
  started_at: string;
  finished_at?: string | null;
}

export interface User {
  id: string;
  name: string;
  email?: string | null;
  telegram_chat_id?: string | null;
  institution?: string | null;
  branch?: string | null;
  semester?: string | null;
  scheme?: string | null;
  annual_income?: number | null;
  social_category?: string | null;
  domicile?: string | null;
  preferences?: NotificationPreferences | null;
  created_at: string;
}

export interface AppConfig {
  telegram_bot_username: string;
  llm_configured: boolean;
  llm_provider?: string;
  llm_model?: string;
  telegram_configured: boolean;
  scan_interval_minutes: number;
  watch_interval_seconds?: number;
  auto_scan_on_change?: boolean;
  alert_grace_seconds?: number;
  default_goal: string;
  active_sources: number;
  categories: Record<Category, string>;
}

export interface Health {
  ok: boolean;
  tinyfish_configured: boolean;
  llm_configured: boolean;
  telegram_configured: boolean;
  llm?: { configured?: boolean; ok?: boolean; detail?: string } | null;
}

export interface Stats {
  circulars: number;
  alerts: number;
  sources: number;
  users: number;
  by_category: Partial<Record<Category, number>>;
  last_scan_at?: string | null;
}

export interface AgentStep {
  id: string;
  timestamp: string;
  status: string;
  action: string;
  screenshot?: string | null;
  duration?: string | null;
}

export interface AgentRun {
  run_id: string;
  status: string;
  result?: unknown;
  error?: string | null;
  url?: string;
  goal?: string;
  steps: AgentStep[];
  streaming_url?: string | null;
  video_url?: string | null;
  num_of_steps?: number;
  started_at?: string;
  finished_at?: string;
}

export interface AskCitation {
  index: number;
  id?: string;
  title?: string;
  url?: string | null;
  source_name?: string | null;
  published_date?: string | null;
  deadline?: string | null;
}

export interface AskResponse {
  answer: string;
  generated: boolean;
  model?: string | null;
  citations: AskCitation[];
  matched: number;
}

/** Categories the backend classifier actually produces today. */
export const CATEGORY_META: Record<
  Category,
  { label: string; short: string; description: string }
> = {
  SCHOLARSHIP: {
    label: "Scholarships",
    short: "Scholarship",
    description: "Scholarships, fellowships and fee waivers with eligibility and deadlines.",
  },
  EDUCATION_LOAN: {
    label: "Education loans",
    short: "Loan",
    description: "Education loans, interest subsidies and loan application steps.",
  },
  INTERNSHIP: {
    label: "Internships",
    short: "Internship",
    description: "Internships, apprenticeships and summer training opportunities.",
  },
  JOB_OR_PLACEMENT: {
    label: "Jobs & placements",
    short: "Jobs",
    description: "Campus placements, recruitment drives and job openings.",
  },
  COMPETITION: {
    label: "Competitions",
    short: "Competition",
    description: "Hackathons, contests and challenges open to students.",
  },
  RESEARCH_PROGRAMME: {
    label: "Research programmes",
    short: "Research",
    description: "PhD admissions, research internships and research fellowships.",
  },
  EXAM_TIMETABLE: {
    label: "Examinations",
    short: "Exam",
    description: "Timetables, schedules and examination notifications.",
  },
  FEE_OR_FORM_DEADLINE: {
    label: "Fees & applications",
    short: "Fee / form",
    description: "Fee payment, registration and application deadlines.",
  },
  MAKEUP_OR_REVALUATION: {
    label: "Re-evaluation",
    short: "Revaluation",
    description: "Supplementary exams, revaluation and make-up applications.",
  },
  RESULT: {
    label: "Results",
    short: "Result",
    description: "Result announcements and grade card releases.",
  },
  ACADEMIC_POLICY: {
    label: "Academic policy",
    short: "Policy",
    description: "Regulations, ordinances, curriculum and academic policy changes.",
  },
  STUDENT_WELFARE: {
    label: "Student welfare",
    short: "Welfare",
    description: "Hostel, health, safety, grievance and student support notices.",
  },
  HOLIDAY_OR_GENERAL: {
    label: "General notices",
    short: "General",
    description: "Holidays, circulars and other general institutional notices.",
  },
};

export const CATEGORY_ORDER: Category[] = [
  "SCHOLARSHIP",
  "EDUCATION_LOAN",
  "INTERNSHIP",
  "JOB_OR_PLACEMENT",
  "COMPETITION",
  "RESEARCH_PROGRAMME",
  "EXAM_TIMETABLE",
  "FEE_OR_FORM_DEADLINE",
  "MAKEUP_OR_REVALUATION",
  "RESULT",
  "ACADEMIC_POLICY",
  "STUDENT_WELFARE",
  "HOLIDAY_OR_GENERAL",
];

export const URGENCY_META: Record<Urgency, { label: string; tone: "danger" | "warning" | "neutral" }> = {
  HIGH: { label: "High priority", tone: "danger" },
  MEDIUM: { label: "Medium priority", tone: "warning" },
  LOW: { label: "Routine", tone: "neutral" },
};

export type CategoryTone =
  | "neutral"
  | "quiet"
  | "success"
  | "warning"
  | "danger"
  | "ink"
  | "lime"
  | "cobalt";

/** Colour per notice type so exams, fees and results are distinguishable at a glance. */
export const CATEGORY_TONE: Record<Category, CategoryTone> = {
  SCHOLARSHIP: "lime",
  EDUCATION_LOAN: "quiet",
  INTERNSHIP: "cobalt",
  JOB_OR_PLACEMENT: "success",
  COMPETITION: "warning",
  RESEARCH_PROGRAMME: "ink",
  EXAM_TIMETABLE: "cobalt",
  FEE_OR_FORM_DEADLINE: "warning",
  MAKEUP_OR_REVALUATION: "danger",
  RESULT: "success",
  ACADEMIC_POLICY: "ink",
  STUDENT_WELFARE: "quiet",
  HOLIDAY_OR_GENERAL: "neutral",
};

export const INSTITUTION_TYPES = [
  "Affiliated college",
  "Autonomous college",
  "Private university",
  "State university",
  "Central university",
  "Deemed university",
  "Other recognised institution",
];

export const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export const DEFAULT_ALERT_CATEGORIES: Category[] = [
  "SCHOLARSHIP",
  "EDUCATION_LOAN",
  "INTERNSHIP",
  "JOB_OR_PLACEMENT",
  "COMPETITION",
  "RESEARCH_PROGRAMME",
];

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  categories: DEFAULT_ALERT_CATEGORIES,
  min_urgency: "LOW",
  deadline_within_days: null,
  include_without_deadline: true,
};
