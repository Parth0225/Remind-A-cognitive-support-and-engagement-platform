"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import AppFrame from "@/components/AppFrame";
import {
  api,
  ApiError,
  type Account,
  type PracticeAnswer,
  type PracticeSessionResult,
  type PracticeSessionStart,
} from "@/lib/api";
import { useSettings } from "../providers";

const activityNamesHi: Record<string, string> = {
  "memory-sequence": "याद रखने का अभ्यास",
  "attention-match": "ध्यान और मिलान",
  "problem-pattern": "पैटर्न पूरा करें",
};

export default function PracticeSessionPage() {
  const router = useRouter();
  const { language, t } = useSettings();
  const [account, setAccount] = useState<Account | null>(null);
  const [session, setSession] = useState<PracticeSessionStart | null>(null);
  const [sessionResult, setSessionResult] = useState<PracticeSessionResult | null>(null);
  const [answers, setAnswers] = useState<PracticeAnswer[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const questionStartedAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function beginSession() {
      try {
        const currentAccount = await api<Account>("/auth/me");
        if (currentAccount.role !== "patient") {
          router.replace("/dashboard");
          return;
        }
        if (cancelled) return;
        setAccount(currentAccount);
        const currentSession = await api<PracticeSessionStart>("/patient/practice-sessions/start", {
          method: "POST",
        });
        if (cancelled) return;
        setSession(currentSession);
        questionStartedAt.current = performance.now();
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.status === 401) {
          router.replace("/login");
          return;
        }
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not start the practice session.");
        }
      }
    }
    void beginSession();
    return () => { cancelled = true; };
  }, [router]);

  async function continueSession() {
    if (!session || selectedAnswer === null || busy) return;
    setError("");
    const currentQuestion = session.questions[questionIndex];
    const recordedAnswer: PracticeAnswer = {
      question_id: currentQuestion.question_id,
      selected_answer: selectedAnswer,
      duration_seconds: Math.max(1, Math.ceil((performance.now() - questionStartedAt.current) / 1000)),
    };
    const updatedAnswers = [...answers, recordedAnswer];
    if (questionIndex + 1 < session.questions.length) {
      setAnswers(updatedAnswers);
      setQuestionIndex(questionIndex + 1);
      setSelectedAnswer(null);
      questionStartedAt.current = performance.now();
      return;
    }

    setBusy(true);
    try {
      const completed = await api<PracticeSessionResult>(
        `/patient/practice-sessions/${session.session_id}/complete`,
        {
          method: "POST",
          body: JSON.stringify({ answers: updatedAnswers }),
        },
      );
      setAnswers(updatedAnswers);
      setSessionResult(completed);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save your practice session.");
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <Stack spacing={2} sx={{ minHeight: "70vh", maxWidth: 700, justifyContent: "center", mx: "auto", p: 3 }}>
        {error ? <Alert severity="error">{error}</Alert> : <CircularProgress aria-label={t("loading")} />}
        {error && <Button variant="outlined" onClick={() => router.replace("/dashboard")}>{t("dashboard")}</Button>}
      </Stack>
    );
  }

  const frame = (children: ReactNode) => (
    <AppFrame
      name={account.name}
      email={account.email}
      role={account.role}
      onProfileUpdated={(name) => setAccount((current) => current ? { ...current, name } : current)}
    >
      {children}
    </AppFrame>
  );

  if (sessionResult) {
    return frame(
      <Stack spacing={2} sx={{ maxWidth: 760, mx: "auto" }}>
        <Alert severity="success">Your practice session is complete.</Alert>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h4" sx={{ fontWeight: 750 }}>
                {language === "hi" ? "बहुत अच्छा काम!" : "Well done!"}
              </Typography>
              <Typography>
                {language === "hi"
                  ? "आपके उत्तर सुरक्षित हैं। आपका डॉक्टर रिपोर्ट की समीक्षा और स्वीकृति के बाद इसे आपके डैशबोर्ड पर साझा करेगा।"
                  : "Your answers are saved. Your doctor will review and approve the report before it appears on your dashboard."}
              </Typography>
              <Typography color="text.secondary">
                {language === "hi"
                  ? "यह अभ्यास गतिविधि है, चिकित्सीय परीक्षण या निदान नहीं।"
                  : "This is a practice activity, not a clinical test or diagnosis."}
              </Typography>
              <Box>
                <Button variant="contained" onClick={() => router.replace("/dashboard")}>
                  {t("dashboard")}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>,
    );
  }

  if (!session) {
    return frame(
      <Stack spacing={2} sx={{ maxWidth: 760, mx: "auto" }}>
        {error && <Alert severity="error">{error}</Alert>}
        <Button variant="outlined" onClick={() => router.replace("/dashboard")}>{t("dashboard")}</Button>
      </Stack>,
    );
  }

  const question = session.questions[questionIndex];
  const prompt = language === "hi" ? question.prompt_hi : question.prompt_en;
  const choices = language === "hi" ? question.choices_hi : question.choices_en;
  const activityName = language === "hi"
    ? activityNamesHi[question.activity_key] ?? question.activity_name
    : question.activity_name;

  return frame(
    <Stack spacing={2.5} sx={{ maxWidth: 760, mx: "auto" }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 750 }}>
          {session.is_baseline
            ? (language === "hi" ? "पहला अभ्यास सत्र" : "First practice session")
            : (language === "hi" ? "दैनिक अभ्यास" : "Daily practice")}
        </Typography>
        <Typography color="text.secondary">
          {language === "hi"
            ? "ये मूल अभ्यास प्रश्न हैं, मानकीकृत चिकित्सीय परीक्षण नहीं।"
            : "These are original practice questions, not a standardized clinical test."}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {language === "hi" ? `प्रश्न ${questionIndex + 1} / ${session.total_items}` : `Question ${questionIndex + 1} of ${session.total_items}`}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={((questionIndex + 1) / session.total_items) * 100}
                aria-label={language === "hi" ? "सत्र की प्रगति" : "Session progress"}
                sx={{ mt: 1, height: 8, borderRadius: 4 }}
              />
            </Box>
            <Box>
              <Typography variant="overline" color="text.secondary">{activityName}</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>{prompt}</Typography>
            </Box>
            <Stack spacing={1}>
              {choices.map((choice, index) => (
                <Button
                  key={`${question.question_id}-${index}`}
                  variant={selectedAnswer === index ? "contained" : "outlined"}
                  onClick={() => setSelectedAnswer(index)}
                  aria-pressed={selectedAnswer === index}
                  sx={{ justifyContent: "flex-start", minHeight: 54, fontSize: "1.05rem", px: 2 }}
                >
                  {choice}
                </Button>
              ))}
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1 }}>
              <Button onClick={() => router.replace("/dashboard")} disabled={busy}>
                {language === "hi" ? "अभी छोड़ें" : "Exit session"}
              </Button>
              <Button variant="contained" onClick={() => void continueSession()} disabled={selectedAnswer === null || busy}>
                {busy
                  ? t("loading")
                  : questionIndex + 1 === session.total_items
                    ? (language === "hi" ? "सत्र पूरा करें" : "Finish session")
                    : (language === "hi" ? "अगला प्रश्न" : "Next question")}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
