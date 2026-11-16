"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  LinearProgress,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { api, type DoctorAssessmentRecord } from "@/lib/api";
import { useSettings } from "../providers";

const assessmentInstruments = [
  { key: "mmse", name: "MMSE" },
  { key: "moca", name: "MoCA" },
  { key: "cdr", name: "CDR" },
  { key: "adl", name: "ADL" },
  { key: "iadl", name: "IADL" },
  { key: "gds", name: "GDS" },
  { key: "faq", name: "FAQ" },
  { key: "npi", name: "NPI" },
  { key: "hads", name: "HADS" },
  { key: "ace_iii", name: "ACE-III" },
] as const;

type AssessmentKey = (typeof assessmentInstruments)[number]["key"];
type PatientTab = "overview" | "assessments" | "activities" | "reports";

interface DoctorPatient {
  id: string;
  name: string;
  email: string;
  assessment_count: number;
  activity_count: number;
  practice_session_count: number;
  pending_report_count: number;
  assigned_at: string;
}

interface PlanProposal {
  id: string;
  activity_key: string;
  old_level: number;
  proposed_level: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  decision_note?: string;
}

interface DoctorReport {
  id: string;
  title: string;
  body: string;
  status: "draft" | "published";
  created_at: string;
}

interface PracticeSession {
  id: string;
  is_baseline: number;
  total_items: number;
  correct_items: number;
  duration_seconds: number;
  started_at: string;
  completed_at: string | null;
  report_id: string | null;
}

interface ActivityEvent {
  activity_key: string;
  activity_name: string;
  score: number;
  perceived_difficulty: string;
  duration_seconds: number;
  is_correct: number;
  created_at: string;
}

interface PatientDetail {
  patient: { id: string; full_name: string; email: string } | null;
  assessments: DoctorAssessmentRecord[];
  activities: ActivityEvent[];
  practice_sessions: PracticeSession[];
  activity_plans: Array<{ activity_key: string; level: number; updated_at: string }>;
  proposals: PlanProposal[];
  reports: DoctorReport[];
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function practiceAccuracyChange(sessions: PracticeSession[]): { value: string; detail: string } {
  const chronological = [...sessions].sort(
    (first, second) =>
      new Date(first.completed_at ?? first.started_at).getTime()
      - new Date(second.completed_at ?? second.started_at).getTime(),
  );
  if (chronological.length < 2) {
    return { value: "—", detail: "Complete two sessions to compare practice scores." };
  }
  const first = chronological[0];
  const latest = chronological[chronological.length - 1];
  const firstAccuracy = first.correct_items / first.total_items;
  const latestAccuracy = latest.correct_items / latest.total_items;
  const change = (latestAccuracy - firstAccuracy) * 100;
  return {
    value: `${change > 0 ? "+" : ""}${change.toFixed(1)} pp`,
    detail: `${formatPercent(firstAccuracy)} first session · ${formatPercent(latestAccuracy)} latest`,
  };
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h5" sx={{ fontWeight: 750, my: 0.5 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{detail}</Typography>
      </CardContent>
    </Card>
  );
}

function AccuracyTrend({ sessions }: { sessions: PracticeSession[] }) {
  const points = [...sessions].reverse();
  if (points.length === 0) {
    return <Typography color="text.secondary">Complete a practice session to see progress here.</Typography>;
  }
  const width = 620;
  const height = 220;
  const padding = { top: 18, right: 24, bottom: 38, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const coordinates = points.map((session, index) => {
    const accuracy = session.total_items > 0 ? session.correct_items / session.total_items : 0;
    return {
      x: padding.left + (points.length === 1 ? chartWidth / 2 : index * chartWidth / (points.length - 1)),
      y: padding.top + (1 - accuracy) * chartHeight,
      accuracy,
      session,
    };
  });
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Practice score and accuracy trend" style={{ width: "100%", minWidth: 360 }}>
        {[0, 0.5, 1].map((fraction) => {
          const y = padding.top + fraction * chartHeight;
          return (
            <g key={fraction}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="currentColor" opacity="0.16" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fill="currentColor" fontSize="12">
                {Math.round((1 - fraction) * 100)}%
              </text>
            </g>
          );
        })}
        <polyline points={line} fill="none" stroke="var(--mui-palette-primary-main, #2563eb)" strokeWidth="3" strokeLinejoin="round" />
        {coordinates.map((point, index) => (
          <circle key={point.session.id} cx={point.x} cy={point.y} r="5" fill="var(--mui-palette-primary-main, #2563eb)">
            <title>{`Session ${index + 1}: ${point.session.correct_items}/${point.session.total_items} (${formatPercent(point.accuracy)})`}</title>
          </circle>
        ))}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1]
          .filter((index, uniqueIndex, values) => values.indexOf(index) === uniqueIndex)
          .map((index) => (
            <text
              key={points[index].id}
              x={coordinates[index].x}
              y={height - 10}
              textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
              fill="currentColor"
              fontSize="11"
            >
              {new Date(points[index].completed_at ?? points[index].started_at).toLocaleDateString()}
            </text>
          ))}
      </svg>
    </Box>
  );
}

function ActivityBreakdown({ activities, metric }: { activities: ActivityEvent[]; metric: "accuracy" | "time" }) {
  const summary = useMemo(() => {
    const grouped = new Map<string, { name: string; correct: number; count: number; seconds: number }>();
    for (const activity of activities) {
      const current = grouped.get(activity.activity_key) ?? {
        name: activity.activity_name,
        correct: 0,
        count: 0,
        seconds: 0,
      };
      current.correct += Number(Boolean(activity.is_correct));
      current.count += 1;
      current.seconds += activity.duration_seconds;
      grouped.set(activity.activity_key, current);
    }
    return [...grouped.entries()].map(([key, result]) => ({
      key,
      name: result.name,
      accuracy: result.correct / result.count,
      averageSeconds: result.seconds / result.count,
      count: result.count,
    }));
  }, [activities]);
  const largest = Math.max(
    1,
    ...summary.map((item) => metric === "accuracy" ? item.accuracy * 100 : item.averageSeconds),
  );

  if (summary.length === 0) {
    return <Typography color="text.secondary">No question-level practice data yet.</Typography>;
  }

  return (
    <Stack spacing={1.5}>
      {summary.map((item) => {
        const value = metric === "accuracy" ? item.accuracy * 100 : item.averageSeconds;
        return (
          <Box key={item.key}>
            <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, mb: 0.5 }}>
              <Typography variant="body2">{item.name}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 650 }}>
                {metric === "accuracy" ? formatPercent(item.accuracy) : `${item.averageSeconds.toFixed(1)} sec / question`}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.max(3, value / largest * 100)}
              aria-label={`${item.name}: ${metric === "accuracy" ? formatPercent(item.accuracy) : `${item.averageSeconds.toFixed(1)} seconds average`}`}
              sx={{ height: 9, borderRadius: 5 }}
            />
            <Typography variant="caption" color="text.secondary">
              {item.count} recent questions recorded
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

function SessionTimeChart({ sessions }: { sessions: PracticeSession[] }) {
  const recent = [...sessions].reverse().slice(-10);
  if (recent.length === 0) {
    return <Typography color="text.secondary">Session timing will appear after the first practice session.</Typography>;
  }
  const maxMinutes = Math.max(1, ...recent.map((session) => session.duration_seconds / 60));
  return (
    <Stack spacing={1}>
      {recent.map((session, index) => {
        const minutes = session.duration_seconds / 60;
        return (
          <Stack key={session.id} direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Typography variant="caption" sx={{ minWidth: 68 }}>
              {index + 1}. {session.is_baseline ? "Baseline" : "Practice"}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.max(3, minutes / maxMinutes * 100)}
              aria-label={`Session ${index + 1}: ${minutes.toFixed(1)} minutes`}
              sx={{ flex: 1, height: 9, borderRadius: 5 }}
            />
            <Typography variant="caption" sx={{ minWidth: 54, textAlign: "right" }}>{minutes.toFixed(1)} min</Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

function AssessmentHistory({ assessments }: { assessments: DoctorAssessmentRecord[] }) {
  if (assessments.length === 0) {
    return <Typography color="text.secondary">No assessment results have been recorded.</Typography>;
  }
  return (
    <Stack divider={<Divider flexItem />} spacing={1.5}>
      {assessments.map((assessment) => (
        <Box key={assessment.id}>
          <Typography sx={{ fontWeight: 650 }}>
            {assessment.instrument_name}: {assessment.score}
            {assessment.score_max !== null ? ` / ${assessment.score_max}` : ""}
            {assessment.instrument_version ? ` · ${assessment.instrument_version}` : ""}
          </Typography>
          <Typography variant="body2">
            Time: {assessment.duration_seconds === null ? "not recorded" : `${assessment.duration_seconds} sec`}
            {" · "}
            Correctness: {assessment.correct_items !== null && assessment.total_items !== null
              ? `${assessment.correct_items}/${assessment.total_items} (${formatPercent(assessment.correct_items / assessment.total_items)})`
              : "not recorded / not applicable"}
          </Typography>
          {assessment.notes && <Typography variant="body2">{assessment.notes}</Typography>}
          <Typography variant="caption" color="text.secondary">{new Date(assessment.created_at).toLocaleString()}</Typography>
        </Box>
      ))}
    </Stack>
  );
}

export default function DoctorDashboard() {
  const { t } = useSettings();
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [activeTab, setActiveTab] = useState<PatientTab>("overview");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [instrumentKey, setInstrumentKey] = useState<AssessmentKey>("mmse");
  const [assessmentScore, setAssessmentScore] = useState("");
  const [scoreMaximum, setScoreMaximum] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [correctItems, setCorrectItems] = useState("");
  const [totalItems, setTotalItems] = useState("");
  const [instrumentVersion, setInstrumentVersion] = useState("");
  const [assessmentNotes, setAssessmentNotes] = useState("");
  const [externallyAdministered, setExternallyAdministered] = useState(false);

  const loadPatients = useCallback(async () => {
    const result = await api<DoctorPatient[]>("/doctor/patients");
    setPatients(result);
    setSelectedPatient((current) => current || result[0]?.id || "");
  }, []);

  const loadDetail = useCallback(async (patientId: string) => {
    if (!patientId) {
      setDetail(null);
      return;
    }
    const result = await api<PatientDetail>(`/doctor/patients/${patientId}`);
    setDetail(result);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialPatients() {
      try {
        const result = await api<DoctorPatient[]>("/doctor/patients");
        if (cancelled) return;
        setPatients(result);
        setSelectedPatient((current) => current || result[0]?.id || "");
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load assigned patients.");
      }
    }
    void loadInitialPatients();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedPatient) return;
    let cancelled = false;
    async function loadSelectedPatient() {
      try {
        const result = await api<PatientDetail>(`/doctor/patients/${selectedPatient}`);
        if (!cancelled) setDetail(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load patient details.");
      }
    }
    void loadSelectedPatient();
    return () => { cancelled = true; };
  }, [selectedPatient]);

  async function saveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await api(`/doctor/patients/${selectedPatient}/assessments`, {
        method: "POST",
        body: JSON.stringify({
          instrument_key: instrumentKey,
          score: Number(assessmentScore),
          score_max: scoreMaximum ? Number(scoreMaximum) : null,
          duration_seconds: Number(durationSeconds),
          correct_items: correctItems ? Number(correctItems) : null,
          total_items: totalItems ? Number(totalItems) : null,
          instrument_version: instrumentVersion,
          notes: assessmentNotes,
          administered_externally: externallyAdministered,
        }),
      });
      setNotice("Assessment result recorded; the report draft remains private until you approve it.");
      setAssessmentScore("");
      setScoreMaximum("");
      setDurationSeconds("");
      setCorrectItems("");
      setTotalItems("");
      setInstrumentVersion("");
      setAssessmentNotes("");
      setExternallyAdministered(false);
      await Promise.all([loadPatients(), loadDetail(selectedPatient)]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not record the assessment.");
    } finally {
      setBusy(false);
    }
  }

  async function decideProposal(proposal: PlanProposal, approved: boolean) {
    setError("");
    setNotice("");
    try {
      await api(`/doctor/proposals/${proposal.id}/decision`, {
        method: "POST",
        body: JSON.stringify({
          approved,
          note: approved ? "Reviewed by assigned doctor." : "Current plan retained after review.",
        }),
      });
      setNotice(approved ? "Activity plan updated after your approval." : "Suggestion rejected; current activity plan remains in place.");
      await loadDetail(selectedPatient);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not update the activity plan.");
    }
  }

  async function approveReport(report: DoctorReport) {
    setError("");
    setNotice("");
    try {
      await api(`/doctor/reports/${report.id}/approve`, { method: "POST" });
      setNotice("Report approved and shared with the patient.");
      await Promise.all([loadPatients(), loadDetail(selectedPatient)]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not approve the report.");
    }
  }

  const pendingReports = detail?.reports.filter((report) => report.status === "draft").length ?? 0;
  const practiceChange = practiceAccuracyChange(detail?.practice_sessions ?? []);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 750 }}>{t("doctor")} {t("dashboard")}</Typography>
        <Typography color="text.secondary">Choose a patient to review their progress, assessments, activities, and reports.</Typography>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}

      {patients.length === 0 ? (
        <Alert severity="info">No patients have consented to an assignment yet. The admin manages patient assignments.</Alert>
      ) : (
        <Grid container spacing={2} sx={{ alignItems: "flex-start" }}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={1.5}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Patients</Typography>
              {patients.map((patient) => (
                <Card
                  key={patient.id}
                  variant="outlined"
                  sx={{
                    borderColor: selectedPatient === patient.id ? "primary.main" : "divider",
                    borderWidth: selectedPatient === patient.id ? 2 : 1,
                  }}
                >
                  <Button
                    fullWidth
                    onClick={() => {
                      setSelectedPatient(patient.id);
                      setDetail(null);
                      setActiveTab("overview");
                      setError("");
                    }}
                    sx={{ display: "block", textAlign: "left", p: 1.5, color: "text.primary" }}
                  >
                    <Typography sx={{ fontWeight: 700 }}>{patient.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", overflowWrap: "anywhere" }}>
                      {patient.email}
                    </Typography>
                    <Stack direction="row" useFlexGap sx={{ gap: 0.75, mt: 1, flexWrap: "wrap" }}>
                      <Chip size="small" label={`${patient.practice_session_count} practice`} />
                      {patient.pending_report_count > 0 && (
                        <Chip size="small" color="warning" label={`${patient.pending_report_count} to review`} />
                      )}
                    </Stack>
                  </Button>
                </Card>
              ))}
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 9 }}>
            {!detail?.patient ? (
              <Typography color="text.secondary">Loading patient details…</Typography>
            ) : (
              <Stack spacing={2}>
                <Card>
                  <CardContent>
                    <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1, alignItems: { sm: "center" } }}>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 750 }}>{detail.patient.full_name}</Typography>
                        <Typography color="text.secondary">{detail.patient.email}</Typography>
                      </Box>
                      <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: "wrap" }}>
                        <Chip label={`${detail.assessments.length} assessments`} />
                        <Chip label={`${detail.practice_sessions.length} practice sessions`} />
                        <Chip label={`${pendingReports} reports to review`} color={pendingReports ? "warning" : "default"} />
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Tabs
                  value={activeTab}
                  onChange={(_, value: PatientTab) => setActiveTab(value)}
                  variant="scrollable"
                  scrollButtons="auto"
                  aria-label="Selected patient sections"
                >
                  <Tab label="Overview" value="overview" />
                  <Tab label="Assessments" value="assessments" />
                  <Tab label="Activities" value="activities" />
                  <Tab label={`Reports${pendingReports ? ` (${pendingReports})` : ""}`} value="reports" />
                </Tabs>

                {activeTab === "overview" && (
                  <Stack spacing={2}>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <MetricCard
                          label="Practice sessions"
                          value={String(detail.practice_sessions.length)}
                          detail={detail.practice_sessions.length ? "Completed sessions" : "No sessions yet"}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <MetricCard
                          label="Latest practice accuracy"
                          value={detail.practice_sessions[0]
                            ? formatPercent(detail.practice_sessions[0].correct_items / detail.practice_sessions[0].total_items)
                            : "—"}
                          detail={detail.practice_sessions[0]
                            ? new Date(detail.practice_sessions[0].completed_at ?? detail.practice_sessions[0].started_at).toLocaleDateString()
                            : "Complete a practice session"}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <MetricCard
                          label="Practice score change"
                          value={practiceChange.value}
                          detail={`${practiceChange.detail} · practice-only, not a clinical measure`}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <MetricCard
                          label="Assessments recorded"
                          value={String(detail.assessments.length)}
                          detail="Clinician-entered external results"
                        />
                      </Grid>
                    </Grid>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, lg: 7 }}>
                        <Card>
                          <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Practice score and progress over time</Typography>
                            <AccuracyTrend sessions={detail.practice_sessions} />
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid size={{ xs: 12, lg: 5 }}>
                        <Card>
                          <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Session time</Typography>
                            <SessionTimeChart sessions={detail.practice_sessions} />
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Recent performance by activity</Typography>
                        <ActivityBreakdown activities={detail.activities} metric="accuracy" />
                      </CardContent>
                    </Card>
                  </Stack>
                )}

                {activeTab === "assessments" && (
                  <Stack spacing={2}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Record externally administered result</Typography>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                          ReMind does not provide standardized test questions, scoring instructions, or diagnoses. Enter results only from an authorized external administration.
                        </Alert>
                        {instrumentKey === "mmse" && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            An externally administered MMSE result establishes the starter activity baseline. Other instruments remain separate records.
                          </Alert>
                        )}
                        <Stack component="form" spacing={2} onSubmit={saveAssessment}>
                          <TextField
                            select
                            label="Assessment instrument"
                            value={instrumentKey}
                            onChange={(event) => setInstrumentKey(event.target.value as AssessmentKey)}
                            required
                          >
                            {assessmentInstruments.map((instrument) => (
                              <MenuItem key={instrument.key} value={instrument.key}>{instrument.name}</MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            label="Clinician-entered score"
                            type="number"
                            value={assessmentScore}
                            onChange={(event) => setAssessmentScore(event.target.value)}
                            slotProps={{ htmlInput: { min: 0, step: "any" } }}
                            required
                          />
                          <TextField
                            label="Maximum score (if applicable)"
                            type="number"
                            value={scoreMaximum}
                            onChange={(event) => setScoreMaximum(event.target.value)}
                            slotProps={{ htmlInput: { min: 0, step: "any" } }}
                          />
                          <TextField
                            label="Time taken (seconds)"
                            type="number"
                            value={durationSeconds}
                            onChange={(event) => setDurationSeconds(event.target.value)}
                            slotProps={{ htmlInput: { min: 1, max: 86400, step: 1 } }}
                            required
                          />
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                            <TextField
                              label="Correct items (if available)"
                              type="number"
                              value={correctItems}
                              onChange={(event) => setCorrectItems(event.target.value)}
                              slotProps={{ htmlInput: { min: 0, step: 1 } }}
                            />
                            <TextField
                              label="Total items (if available)"
                              type="number"
                              value={totalItems}
                              onChange={(event) => setTotalItems(event.target.value)}
                              slotProps={{ htmlInput: { min: 1, step: 1 } }}
                            />
                          </Stack>
                          <TextField
                            label="Instrument version"
                            value={instrumentVersion}
                            onChange={(event) => setInstrumentVersion(event.target.value)}
                            helperText="Record the exact authorized version used."
                          />
                          <TextField
                            label="Clinician notes"
                            value={assessmentNotes}
                            onChange={(event) => setAssessmentNotes(event.target.value)}
                            multiline
                            minRows={3}
                            slotProps={{ htmlInput: { maxLength: 2000 } }}
                          />
                          <FormControlLabel
                            control={<Checkbox checked={externallyAdministered} onChange={(event) => setExternallyAdministered(event.target.checked)} required />}
                            label="I recorded results from an authorized assessment administered outside ReMind."
                          />
                          <Button type="submit" variant="contained" disabled={busy || !externallyAdministered}>
                            Save result and create doctor-review draft
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Assessment history</Typography>
                        <AssessmentHistory assessments={detail.assessments} />
                      </CardContent>
                    </Card>
                  </Stack>
                )}

                {activeTab === "activities" && (
                  <Stack spacing={2}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Doctor-approved activity levels</Typography>
                        {detail.activity_plans.length === 0
                          ? <Typography color="text.secondary">Activity levels are created after an external baseline is recorded.</Typography>
                          : <Stack spacing={1}>
                            {detail.activity_plans.map((plan) => (
                              <Stack key={plan.activity_key} direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 1, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                                <Typography sx={{ fontWeight: 650 }}>{plan.activity_key.replaceAll("-", " ")}</Typography>
                                <Chip label={`Level ${plan.level}`} />
                              </Stack>
                            ))}
                          </Stack>}
                      </CardContent>
                    </Card>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card>
                          <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Accuracy by activity</Typography>
                            <ActivityBreakdown activities={detail.activities} metric="accuracy" />
                          </CardContent>
                        </Card>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card>
                          <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Average response time</Typography>
                            <ActivityBreakdown activities={detail.activities} metric="time" />
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Plan changes awaiting your approval</Typography>
                        {detail.proposals.length === 0
                          ? <Typography color="text.secondary">No activity changes are awaiting review.</Typography>
                          : <Stack divider={<Divider flexItem />} spacing={1.5}>
                            {detail.proposals.map((proposal) => (
                              <Stack key={proposal.id} direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1 }}>
                                <Box>
                                  <Typography sx={{ fontWeight: 650 }}>
                                    {proposal.activity_key.replaceAll("-", " ")} · Level {proposal.old_level} → {proposal.proposed_level}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">{proposal.reason}</Typography>
                                  <Chip size="small" sx={{ mt: 1 }} label={proposal.status} color={proposal.status === "pending" ? "warning" : "default"} />
                                </Box>
                                {proposal.status === "pending" && (
                                  <Stack direction="row" spacing={1}>
                                    <Button size="small" variant="contained" onClick={() => void decideProposal(proposal, true)}>{t("approve")}</Button>
                                    <Button size="small" onClick={() => void decideProposal(proposal, false)}>{t("reject")}</Button>
                                  </Stack>
                                )}
                              </Stack>
                            ))}
                          </Stack>}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Recent question responses</Typography>
                        {detail.activities.length === 0
                          ? <Typography color="text.secondary">No questions have been completed.</Typography>
                          : <Stack divider={<Divider flexItem />} spacing={1}>
                            {detail.activities.slice(0, 20).map((activity, index) => (
                              <Stack key={`${activity.activity_key}-${activity.created_at}-${index}`} direction="row" sx={{ justifyContent: "space-between", gap: 1, alignItems: "center" }}>
                                <Box>
                                  <Typography sx={{ fontWeight: 600 }}>{activity.activity_name}</Typography>
                                  <Typography variant="caption" color="text.secondary">{new Date(activity.created_at).toLocaleString()}</Typography>
                                </Box>
                                <Typography variant="body2">
                                  {activity.is_correct ? "Correct" : "Incorrect"} · {activity.duration_seconds} sec
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>}
                      </CardContent>
                    </Card>
                  </Stack>
                )}

                {activeTab === "reports" && (
                  <Stack spacing={2}>
                    {detail.reports.length === 0 ? (
                      <Alert severity="info">No report drafts yet. Completed practice sessions and recorded assessments create doctor-review drafts.</Alert>
                    ) : detail.reports.map((report) => (
                      <Card key={report.id}>
                        <CardContent>
                          <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, gap: 1 }}>
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>{report.title}</Typography>
                              <Typography variant="caption" color="text.secondary">{new Date(report.created_at).toLocaleString()}</Typography>
                            </Box>
                            <Chip size="small" label={report.status} color={report.status === "draft" ? "warning" : "success"} />
                          </Stack>
                          <Typography variant="body2" sx={{ whiteSpace: "pre-line", my: 2 }}>{report.body}</Typography>
                          {report.status === "draft" ? (
                            <Button variant="contained" onClick={() => void approveReport(report)}>{t("approve")} and share with patient</Button>
                          ) : (
                            <Button component="a" href={`/api/v1/patient/reports/${report.id}/pdf`} target="_blank" rel="noreferrer">
                              {t("downloadPdf")}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Stack>
            )}
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}
