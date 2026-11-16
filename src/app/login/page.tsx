"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { api, ApiError, type Account } from "@/lib/api";
import { useSettings } from "../providers";

type DemoRole = "admin" | "doctor" | "patient";

interface DemoCredentials {
  email: string;
  password: string;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get("role");
  const role: DemoRole = requestedRole === "admin" || requestedRole === "doctor" || requestedRole === "patient"
    ? requestedRole
    : "patient";
  const { t } = useSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [demoReady, setDemoReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      return;
    }
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    const retryDelays = [500, 1000, 2000, 4000];

    async function loadDemoCredentials(attempt = 0) {
      try {
        const credentials = await api<DemoCredentials>(`/auth/demo-credentials?role=${role}`);
        if (cancelled) return;
        setEmail(credentials.email);
        setPassword(credentials.password);
        setDemoReady(true);
      } catch (loadError: unknown) {
        if (cancelled) return;
        const transient = loadError instanceof TypeError
          || (loadError instanceof ApiError && loadError.status >= 500);
        if (transient && attempt < retryDelays.length) {
          retryTimeout = setTimeout(() => {
            void loadDemoCredentials(attempt + 1);
          }, retryDelays[attempt]);
          return;
        }
        console.error("Could not prefill local demo credentials.", loadError);
        setError("Demo credentials could not be loaded. You can still sign in with your own account.");
      }
    }

    void loadDemoCredentials();
    return () => {
      cancelled = true;
      if (retryTimeout !== null) clearTimeout(retryTimeout);
    };
  }, [role]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api<{ account: Account }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (result.account.role !== role) {
        await api("/auth/logout", { method: "POST" });
        throw new Error(`This account is a ${result.account.role}. Choose the matching role to continue.`);
      }
      router.replace("/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sign-in failed.");
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
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>{t(role)} sign in</Typography>
            <Stack component="form" spacing={2} onSubmit={handleSubmit}>
              {demoReady && <Alert severity="info">Local demo credentials have been filled in. You can sign in now.</Alert>}
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label={t("email")}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <TextField
                label={t("password")}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <Button type="submit" variant="contained" size="large" disabled={loading}>
                {loading ? t("loading") : t("signIn")}
              </Button>
            </Stack>
            {role === "patient" && (
              <Typography sx={{ mt: 3 }} color="text.secondary">
                <Link href="/register">{t("registerFirst")}</Link>
              </Typography>
            )}
            <Typography sx={{ mt: 3 }}>
              <Link href="/">Choose a different role</Link>
            </Typography>
            <Typography variant="caption" sx={{ display: "block", mt: 3 }} color="text.secondary">
              Local prototype only. Use synthetic data; do not enter real patient information.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Container sx={{ py: 8 }}><Typography>Loading sign-in…</Typography></Container>}>
      <LoginForm />
    </Suspense>
  );
}
