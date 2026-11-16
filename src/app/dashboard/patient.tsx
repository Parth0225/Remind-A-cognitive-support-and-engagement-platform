"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { api, type Account, type PatientDashboardData, type Reminder } from "@/lib/api";
import { loadDashboardSnapshot, queueEvent, saveDashboardSnapshot, synchronizeQueue } from "@/lib/offline";
import { useSettings } from "../providers";

interface PatientDashboardProps {
  account: Account;
}

const categoryLabels: Record<string, string> = {
  routine: "Daily routine",
  medication: "Medication",
  appointment: "Appointment",
  personal: "Personal task",
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Not recorded";
  if (seconds < 60) return `${seconds} sec`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
}

export default function PatientDashboard({ account }: PatientDashboardProps) {
  const router = useRouter();
  const { t, defaultReminderCategory } = useSettings();
  const [data, setData] = useState<PatientDashboardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderCategory, setReminderCategory] = useState<Reminder["category"]>(defaultReminderCategory);
  const [reminderDueAt, setReminderDueAt] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const current = await api<PatientDashboardData>("/patient/dashboard");
      setData(current);
      setOffline(!navigator.onLine);
      try {
        await saveDashboardSnapshot(account.id, current);
      } catch (storageError) {
        console.error("Could not save the local dashboard snapshot.", storageError);
        setNotice("Offline storage is unavailable in this browser.");
      }
    } catch (loadError) {
      if (loadError instanceof TypeError || !navigator.onLine) {
        try {
          const snapshot = await loadDashboardSnapshot(account.id);
          if (snapshot) {
            setData(snapshot.value as PatientDashboardData);
            setOffline(true);
            setNotice(t("offline"));
            return;
          }
        } catch (storageError) {
          console.error("Could not read the saved dashboard snapshot.", storageError);
        }
      }
      setError(loadError instanceof Error ? loadError.message : "Could not load patient information.");
    }
  }, [account.id, t]);

  const sync = useCallback(async () => {
    try {
      const messages = await synchronizeQueue(account.id);
      setNotice(messages[0] ?? "Your saved activity is synchronized.");
      await refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Could not synchronize saved activity.");
    }
  }, [account.id, refresh]);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialDashboard() {
      try {
        const current = await api<PatientDashboardData>("/patient/dashboard");
        if (cancelled) return;
        setData(current);
        setOffline(!navigator.onLine);
        try {
          await saveDashboardSnapshot(account.id, current);
        } catch (storageError) {
          console.error("Could not save the local dashboard snapshot.", storageError);
          if (!cancelled) setNotice("Offline storage is unavailable in this browser.");
        }
      } catch (loadError) {
        if (loadError instanceof TypeError || !navigator.onLine) {
          try {
            const snapshot = await loadDashboardSnapshot(account.id);
            if (cancelled) return;
            if (snapshot) {
              setData(snapshot.value as PatientDashboardData);
              setOffline(true);
              setNotice(t("offline"));
              return;
            }
          } catch (storageError) {
            console.error("Could not read the saved dashboard snapshot.", storageError);
          }
        }
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load patient information.");
      }
    }
    void loadInitialDashboard();
    const onOnline = () => { void sync(); };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [account.id, sync, t]);

  async function consent(accepted: boolean) {
    setError("");
    setBusy(true);
    try {
      await api("/patient/consent", {
        method: "POST",
        body: JSON.stringify({ accepted }),
      });
      setNotice(accepted ? "Consent recorded. Your doctor can now review your clinical records." : "Your choice was recorded. Contact the admin if you want to discuss another assignment.");
      await refresh();
    } catch (consentError) {
      setError(consentError instanceof Error ? consentError.message : "Could not save your consent.");
    } finally {
      setBusy(false);
    }
  }

  async function createReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const dueAt = new Date(reminderDueAt).toISOString();
    const body = { title: reminderTitle.trim(), category: reminderCategory, due_at: dueAt };
    try {
      if (!navigator.onLine) throw new TypeError("Offline.");
      await api("/patient/reminders", { method: "POST", body: JSON.stringify(body) });
      setNotice("Reminder created.");
    } catch (createError) {
      if (!(createError instanceof TypeError)) {
        setError(createError instanceof Error ? createError.message : "Could not create reminder.");
        setBusy(false);
        return;
      }
      const id = crypto.randomUUID();
      const queued = await queueEvent(account.id, "reminder_create", { ...body, id });
      setData((current) => current ? {
        ...current,
        reminders: [...current.reminders, {
          id,
          ...body,
          completed: 0,
          updated_at: queued.queued_at,
          pending_sync: true,
        }],
      } : current);
      setOffline(true);
      setNotice(t("syncPending"));
    }
    setReminderTitle("");
    setReminderDueAt("");
    setReminderOpen(false);
    setBusy(false);
    if (navigator.onLine) await refresh();
  }

  async function toggleReminder(reminder: Reminder) {
    const updated = {
      id: reminder.id,
      title: reminder.title,
      category: reminder.category,
      due_at: reminder.due_at,
      completed: !Boolean(reminder.completed),
      base_updated_at: reminder.updated_at,
    };
    try {
      if (!navigator.onLine) throw new TypeError("Offline.");
      const response = await api<Reminder | { conflict: boolean; message: string }>("/patient/reminders/" + reminder.id, {
        method: "PUT",
        body: JSON.stringify(updated),
      });
      if ("conflict" in response && response.conflict) {
        setNotice(response.message);
        await refresh();
        return;
      }
      setNotice("Reminder updated.");
      await refresh();
    } catch (updateError) {
      if (!(updateError instanceof TypeError)) {
        setError(updateError instanceof Error ? updateError.message : "Could not update reminder.");
        return;
      }
      const queued = await queueEvent(account.id, "reminder_update", updated);
      setData((current) => current ? {
        ...current,
        reminders: current.reminders.map((item) => item.id === reminder.id
          ? { ...item, completed: updated.completed, updated_at: queued.queued_at, pending_sync: true }
          : item),
      } : current);
      setOffline(true);
      setNotice(t("syncPending"));
    }
  }

  if (!data && !error) return <Typography>{t("loading")}</Typography>;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 750 }}>{t("welcome")}, {account.name}</Typography>
        <Typography color="text.secondary">{t("dashboard")} · ReMind</Typography>
      </Box>
      {offline && <Alert severity="warning">{t("offline")} <Button size="small" onClick={sync}>{t("sync")}</Button></Alert>}
      {notice && <Alert severity="info" onClose={() => setNotice("")}>{notice}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      {data?.waiting_for_assignment && (
        <Card>
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{t("waiting")}</Typography>
            <Typography sx={{ mt: 1 }}>{t("waitingDescription")}</Typography>
            {data.assignment?.status === "declined" && (
              <Alert severity="warning" sx={{ mt: 2 }}>You declined the previous assignment. The administrator must assign a doctor before you can continue.</Alert>
            )}
          </CardContent>
        </Card>
      )}

      {data?.consent_required && data.assignment && (
        <Card>
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{t("reviewAssignment")}</Typography>
            <Typography sx={{ mt: 1 }}>{t("assignedDoctor")}: <strong>{data.assignment.doctor_name}</strong></Typography>
            <Typography color="text.secondary">{data.assignment.doctor_email}</Typography>
            <Alert severity="info" sx={{ my: 2 }}>{t("consent")}</Alert>
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1 }}>
              <Button variant="contained" disabled={busy} onClick={() => consent(true)}>{t("accept")}</Button>
              <Button color="inherit" disabled={busy} onClick={() => consent(false)}>{t("decline")}</Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {data?.assignment?.status === "active" && !data.baseline && (
        <Card>
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{t("baseline")}</Typography>
            <Alert severity="warning" sx={{ my: 2 }}>{t("baselineNotice")}</Alert>
            <Typography color="text.secondary">{t("noBaseline")}</Typography>
          </CardContent>
        </Card>
      )}

      {data?.baseline && (
        <>
          <Alert severity="info">
            {t("demoOnly")} Your baseline was recorded by your assigned doctor.
          </Alert>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: 1 }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{t("activitiesTitle")}</Typography>
                    <Typography color="text.secondary">
                      Original practice questions · 20 questions per session · not a clinical test
                    </Typography>
                  </Box>
                  <Chip
                    color={data.practice_baseline_completed ? "success" : "default"}
                    label={data.practice_baseline_completed ? "First session complete" : "First session"}
                  />
                </Stack>
                <Typography color="text.secondary">
                  {data.practice_baseline_completed
                    ? `${data.practice_session_count} practice sessions completed. New sessions are chosen locally from your previous practice, within your doctor's approved activity levels.`
                    : "Begin with a separate practice baseline. It does not replace an assessment administered by your doctor."}
                </Typography>
                <Box>
                  <Button
                    variant="contained"
                    onClick={() => router.push("/practice-session")}
                  >
                    {data.practice_baseline_completed ? "Start today's practice" : "Start first practice session"}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, gap: 1, mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{t("remindersTitle")}</Typography>
                <Button
                  variant="contained"
                  onClick={() => {
                    setReminderCategory(defaultReminderCategory);
                    setReminderOpen(true);
                  }}
                >
                  {t("addReminder")}
                </Button>
              </Stack>
              {data.reminders.length === 0 ? (
                <Typography color="text.secondary">No reminders yet.</Typography>
              ) : (
                <Stack spacing={1}>
                  {data.reminders.map((reminder) => (
                    <Stack key={reminder.id} direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 650, textDecoration: reminder.completed ? "line-through" : "none" }}>{reminder.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {categoryLabels[reminder.category]} · {new Date(reminder.due_at).toLocaleString()}
                          {reminder.pending_sync ? " · Pending sync" : ""}
                        </Typography>
                      </Box>
                      <Button size="small" onClick={() => toggleReminder(reminder)}>{reminder.completed ? "Mark incomplete" : "Mark complete"}</Button>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>{t("reportsTitle")}</Typography>
              {data.reports.length === 0 ? (
                <Typography color="text.secondary">Your doctor has not published a report yet.</Typography>
              ) : (
                <Stack spacing={1.5}>
                  {data.reports.map((report) => (
                    <Stack
                      key={report.id}
                      direction={{ xs: "column", sm: "row" }}
                      sx={{
                        justifyContent: "space-between",
                        alignItems: { sm: "center" },
                        gap: 1.5,
                        py: 1.5,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Stack spacing={0.5}>
                        <Typography variant="body2">
                          <strong>Date &amp; time:</strong> {new Date(report.approved_at).toLocaleString()}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Time taken:</strong> {formatDuration(report.duration_seconds)}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Score:</strong>{" "}
                          {report.score === null
                            ? "Not recorded"
                            : report.score_max === null
                              ? report.score.toLocaleString()
                              : `${report.score.toLocaleString()} / ${report.score_max.toLocaleString()}`}
                        </Typography>
                      </Stack>
                      <Button
                        component="a"
                        href={`/api/v1/patient/reports/${report.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        variant="outlined"
                      >
                        {t("downloadPdf")}
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
          {data.notifications.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Updates from your care team</Typography>
                {data.notifications.map((item) => (
                  <Typography key={item.id} sx={{ mb: 1 }} color={item.read_at ? "text.secondary" : "text.primary"}>{item.message}</Typography>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={reminderOpen} onClose={() => setReminderOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={createReminder}>
          <DialogTitle>{t("createReminder")}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField label="Reminder" value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} required slotProps={{ htmlInput: { maxLength: 160 } }} />
              <FormControl fullWidth>
                <InputLabel id="reminder-category-label">Category</InputLabel>
                <Select
                  labelId="reminder-category-label"
                  label="Category"
                  value={reminderCategory}
                  onChange={(event) => setReminderCategory(event.target.value as Reminder["category"])}
                >
                  {Object.entries(categoryLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField
                label="Date and time"
                type="datetime-local"
                value={reminderDueAt}
                onChange={(event) => setReminderDueAt(event.target.value)}
                required
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setReminderOpen(false)}>{t("cancel")}</Button>
            <Button type="submit" variant="contained" disabled={busy || !reminderDueAt}>{t("save")}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
