export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function csrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie.split("; ").find((cookie) => cookie.startsWith("remind_csrf="));
  return entry ? decodeURIComponent(entry.slice("remind_csrf=".length)) : null;
}

async function ensureCsrfToken(): Promise<string> {
  const existing = csrfCookie();
  if (existing) return existing;
  const response = await fetch("/api/v1/auth/csrf", { credentials: "include" });
  if (!response.ok) throw new ApiError("Could not start a secure session. Refresh and try again.", response.status);
  const body = (await response.json()) as { token: string };
  return body.token;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    headers.set("X-CSRF-Token", await ensureCsrfToken());
  }

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) message = body.detail;
    } catch {
      message = `Request failed (${response.status}).`;
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface Account {
  id: string;
  name: string;
  email: string;
  role: "patient" | "doctor" | "admin";
  assignment_status?: string;
  assigned_doctor?: string | null;
}

export interface PatientActivity {
  key: string;
  name: string;
  category: string;
  description: string;
  level: number;
}

export type ReminderCategory = "routine" | "medication" | "appointment" | "personal";

export interface Reminder {
  id: string;
  title: string;
  category: ReminderCategory;
  due_at: string;
  completed: number | boolean;
  updated_at: string;
  pending_sync?: boolean;
}

export interface PatientDashboardData {
  assignment: {
    id: string;
    doctor_name: string;
    doctor_email: string;
    status: string;
  } | null;
  baseline: {
    mmse_score: number;
    additional_summary: string;
    recorded_at: string;
  } | null;
  activities: PatientActivity[];
  reminders: Reminder[];
  reports: Array<{
    id: string;
    title: string;
    body: string;
    created_at: string;
    approved_at: string;
    score: number | null;
    score_max: number | null;
    duration_seconds: number | null;
  }>;
  notifications: Array<{ id: string; message: string; created_at: string; read_at: string | null }>;
  practice_baseline_completed: boolean;
  practice_session_count: number;
  consent_required: boolean;
  waiting_for_assignment: boolean;
}

export interface DoctorAssessmentRecord {
  id: string;
  instrument_key: string;
  instrument_name: string;
  score: number;
  score_max: number | null;
  duration_seconds: number | null;
  correct_items: number | null;
  total_items: number | null;
  instrument_version: string;
  notes: string;
  administered_externally: boolean | number;
  created_at: string;
}

export interface PracticeQuestion {
  question_id: string;
  activity_key: string;
  activity_name: string;
  prompt_en: string;
  prompt_hi: string;
  choices_en: string[];
  choices_hi: string[];
}

export interface PracticeSessionStart {
  session_id: string;
  is_baseline: boolean;
  total_items: number;
  started_at: string;
  questions: PracticeQuestion[];
}

export interface PracticeAnswer {
  question_id: string;
  selected_answer: number;
  duration_seconds: number;
}

export interface PracticeSessionResult {
  session_id: string;
  status: "completed";
  message: string;
}
