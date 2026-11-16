"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "@/lib/api";
import { useSettings } from "../providers";

interface AdminPatient {
  id: string;
  name: string;
  email: string;
  registered_at: string;
  assignment_status: string;
  doctor_name: string | null;
}

interface AdminDoctor {
  id: string;
  name: string;
  email: string;
  active: boolean;
  verified: boolean;
  verification_note: string;
}

interface AdminData {
  summary: { patients: number; verified_doctors: number; unassigned_patients: number };
  patients: AdminPatient[];
  doctors: AdminDoctor[];
}

export default function AdminDashboard() {
  const { t } = useSettings();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [doctorName, setDoctorName] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorPassword, setDoctorPassword] = useState("");
  const [verificationNote, setVerificationNote] = useState("");
  const [credentialsVerified, setCredentialsVerified] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");

  const refresh = useCallback(async () => {
    const [summary, patients, doctors] = await Promise.all([
      api<AdminData["summary"]>("/admin/summary"),
      api<AdminPatient[]>("/admin/patients"),
      api<AdminDoctor[]>("/admin/doctors"),
    ]);
    setData({ summary, patients, doctors });
    setPatientId((current) => current || patients.find((item) => item.assignment_status !== "active")?.id || "");
    setDoctorId((current) => current || doctors.find((item) => item.active && item.verified)?.id || "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        const [summary, patients, doctors] = await Promise.all([
          api<AdminData["summary"]>("/admin/summary"),
          api<AdminPatient[]>("/admin/patients"),
          api<AdminDoctor[]>("/admin/doctors"),
        ]);
        if (cancelled) return;
        setData({ summary, patients, doctors });
        setPatientId(patients.find((item) => item.assignment_status !== "active")?.id || "");
        setDoctorId(doctors.find((item) => item.active && item.verified)?.id || "");
      } catch (loadError: unknown) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load admin data.");
      }
    }
    void loadInitialData();
    return () => { cancelled = true; };
  }, []);

  async function createDoctor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await api("/admin/doctors", {
        method: "POST",
        body: JSON.stringify({
          full_name: doctorName,
          email: doctorEmail,
          password: doctorPassword,
          verification_note: verificationNote,
          credentials_verified: credentialsVerified,
        }),
      });
      setDoctorName("");
      setDoctorEmail("");
      setDoctorPassword("");
      setVerificationNote("");
      setCredentialsVerified(false);
      setNotice("Verified doctor account created.");
      await refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create the doctor account.");
    } finally {
      setBusy(false);
    }
  }

  async function assignDoctor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await api<{ status: string }>("/admin/assignments", {
        method: "POST",
        body: JSON.stringify({ patient_id: patientId, doctor_id: doctorId }),
      });
      setNotice("Assignment saved. The patient must sign in and consent before the doctor can view clinical records.");
      await refresh();
      if (result.status !== "pending_consent") setNotice("Assignment status updated.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not assign the doctor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 750 }}>{t("admin")} {t("dashboard")}</Typography>
        <Typography color="text.secondary">{t("noClinicalAccess")}</Typography>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {!data ? (
        <Typography>{t("loading")}</Typography>
      ) : (
        <>
          <Grid container spacing={2}>
            {[
              [t("registeredPatients"), data.summary.patients],
              [t("verifiedDoctors"), data.summary.verified_doctors],
              [t("unassignedPatients"), data.summary.unassigned_patients],
            ].map(([label, value]) => (
              <Grid key={String(label)} size={{ xs: 12, sm: 4 }}>
                <Card><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h3" color="primary.dark">{value}</Typography></CardContent></Card>
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("createDoctor")}</Typography>
                  <Stack component="form" spacing={2} onSubmit={createDoctor}>
                    <TextField label={t("doctorName")} value={doctorName} onChange={(event) => setDoctorName(event.target.value)} required slotProps={{ htmlInput: { minLength: 2, maxLength: 100 } }} />
                    <TextField label={t("email")} type="email" value={doctorEmail} onChange={(event) => setDoctorEmail(event.target.value)} required />
                    <TextField label={t("password")} type="password" value={doctorPassword} onChange={(event) => setDoctorPassword(event.target.value)} required helperText="Set a temporary password of at least 12 characters." slotProps={{ htmlInput: { minLength: 12, maxLength: 128 } }} />
                    <TextField label={t("verificationNote")} value={verificationNote} onChange={(event) => setVerificationNote(event.target.value)} required slotProps={{ htmlInput: { minLength: 4, maxLength: 300 } }} />
                    <FormControlLabel
                      control={<Checkbox checked={credentialsVerified} onChange={(event) => setCredentialsVerified(event.target.checked)} required />}
                      label={t("verifyCredentials")}
                    />
                    <Button type="submit" variant="contained" disabled={busy}>{t("createDoctor")}</Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("adminAssignment")}</Typography>
                  <Stack component="form" spacing={2} onSubmit={assignDoctor}>
                    <TextField select label={t("registeredPatients")} value={patientId} onChange={(event) => setPatientId(event.target.value)} required>
                      {data.patients.map((patient) => (
                        <MenuItem key={patient.id} value={patient.id}>
                          {patient.name} — {patient.assignment_status === "active" ? `assigned to ${patient.doctor_name}` : patient.assignment_status.replace("_", " ")}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField select label={t("verifiedDoctors")} value={doctorId} onChange={(event) => setDoctorId(event.target.value)} required>
                      {data.doctors.filter((doctor) => doctor.active && doctor.verified).map((doctor) => (
                        <MenuItem key={doctor.id} value={doctor.id}>{doctor.name} · {doctor.email}</MenuItem>
                      ))}
                    </TextField>
                    <Button type="submit" variant="contained" disabled={busy || !patientId || !doctorId}>{t("assign")}</Button>
                    <Typography variant="body2" color="text.secondary">
                      Patients cannot choose a doctor. Reassignment immediately revokes the previous doctor&apos;s access.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{t("registeredPatients")}</Typography>
              {data.patients.length === 0 ? (
                <Typography color="text.secondary">No patients have registered yet.</Typography>
              ) : (
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="small" aria-label="Registered patients and assignment status">
                    <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Assignment</TableCell><TableCell>Doctor</TableCell></TableRow></TableHead>
                    <TableBody>
                      {data.patients.map((patient) => (
                        <TableRow key={patient.id}>
                          <TableCell>{patient.name}</TableCell>
                          <TableCell>{patient.email}</TableCell>
                          <TableCell>{patient.assignment_status.replace("_", " ")}</TableCell>
                          <TableCell>{patient.doctor_name ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  );
}
