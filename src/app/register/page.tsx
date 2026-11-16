"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "@/lib/api";
import { useSettings } from "../providers";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useSettings();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({ full_name: fullName, email, password }),
      });
      router.replace("/login");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ minHeight: "100vh", display: "grid", alignItems: "center", py: 4 }}>
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Typography variant="h4" color="primary.dark" sx={{ fontWeight: 800 }}>{t("brand")}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{t("subtitle")}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>{t("register")}</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              After registration, sign in separately. An administrator must assign your doctor before you can begin.
            </Alert>
            <Stack component="form" spacing={2} onSubmit={handleSubmit}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField label={t("fullName")} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required slotProps={{ htmlInput: { minLength: 2, maxLength: 100 } }} />
              <TextField label={t("email")} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <TextField label={t("password")} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required helperText="Use at least 10 characters." slotProps={{ htmlInput: { minLength: 10, maxLength: 128 } }} />
              <Button type="submit" variant="contained" size="large" disabled={loading}>
                {loading ? t("loading") : t("register")}
              </Button>
            </Stack>
            <Typography sx={{ mt: 3 }} color="text.secondary">
              <Link href="/login">{t("alreadyAccount")}</Link>
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
