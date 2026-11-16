"use client";

import { useEffect, useState } from "react";
import { Alert, Box, CircularProgress } from "@mui/material";
import AppFrame from "@/components/AppFrame";
import { api, ApiError, type Account } from "@/lib/api";
import { useSettings } from "../providers";
import AdminDashboard from "./admin";
import DoctorDashboard from "./doctor";
import PatientDashboard from "./patient";

export default function DashboardPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const { t } = useSettings();

  useEffect(() => {
    api<Account>("/auth/me")
      .then(setAccount)
      .catch((loadError: unknown) => {
        if (loadError instanceof ApiError && loadError.status === 401) {
          window.location.replace("/login");
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Could not load your account.");
      });
  }, []);

  if (error) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  }
  if (!account) {
    return <Box sx={{ minHeight: "70vh", display: "grid", placeItems: "center" }}><CircularProgress aria-label={t("loading")} /></Box>;
  }

  return (
    <AppFrame
      name={account.name}
      email={account.email}
      role={account.role}
      onProfileUpdated={(name) => setAccount((current) => current ? { ...current, name } : current)}
    >
      {account.role === "admin" && <AdminDashboard />}
      {account.role === "doctor" && <DoctorDashboard />}
      {account.role === "patient" && <PatientDashboard account={account} />}
    </AppFrame>
  );
}
