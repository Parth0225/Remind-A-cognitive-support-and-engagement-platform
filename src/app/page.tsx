"use client";

import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { useSettings } from "./providers";

const roles = [
  {
    key: "admin",
    description: "Manage demo doctor accounts and patient assignments.",
    href: "/login?role=admin",
    action: "Continue as Admin",
  },
  {
    key: "doctor",
    description: "Review assigned patients, sample reports, and activity proposals.",
    href: "/login?role=doctor",
    action: "Continue as Doctor",
  },
  {
    key: "patient",
    description: "Use activities, reminders, and view doctor-approved reports.",
    href: "/login?role=patient",
    action: "Continue as Patient",
  },
] as const;

export default function Home() {
  const { t } = useSettings();

  return (
    <Container maxWidth="md">
      <Box sx={{ minHeight: "100vh", display: "grid", alignItems: "center", py: 4 }}>
        <Stack spacing={3}>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h3" color="primary.dark" sx={{ fontWeight: 800 }}>{t("brand")}</Typography>
            <Typography color="text.secondary">{t("subtitle")}</Typography>
            <Typography variant="h5" sx={{ mt: 4, fontWeight: 700 }}>Choose how you want to continue</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>This local prototype uses synthetic demo data only.</Typography>
          </Box>
          <Grid container spacing={2}>
            {roles.map((role) => (
              <Grid key={role.key} size={{ xs: 12, md: 4 }}>
                <Card sx={{ height: "100%" }}>
                  <CardContent sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>{t(role.key)}</Typography>
                      <Typography color="text.secondary" sx={{ mt: 1 }}>{role.description}</Typography>
                    </Box>
                    <Button component={Link} href={role.href} variant="contained" sx={{ mt: "auto" }}>
                      {role.action}
                    </Button>
                    {role.key === "patient" && (
                      <Button component={Link} href="/register" variant="text">
                        {t("register")}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            Demo doctor sign-in opens a sample patient with an approved synthetic report. No real assessment data is included.
          </Typography>
        </Stack>
      </Box>
    </Container>
  );
}
