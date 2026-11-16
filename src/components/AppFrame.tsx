"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { api } from "@/lib/api";
import { useSettings, type Language } from "@/app/providers";

interface AppFrameProps {
  name: string;
  email: string;
  role: "patient" | "doctor" | "admin";
  onProfileUpdated: (name: string) => void;
  children: ReactNode;
}

type BrowserPermission = NotificationPermission | "unsupported";

export default function AppFrame({ name, email, role, onProfileUpdated, children }: AppFrameProps) {
  const router = useRouter();
  const {
    language,
    setLanguage,
    defaultReminderCategory,
    setDefaultReminderCategory,
    darkMode,
    toggleDarkMode,
    largeText,
    toggleLargeText,
    highContrast,
    toggleHighContrast,
    t,
  } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileName, setProfileName] = useState(name);
  const [profileBusy, setProfileBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsNotice, setSettingsNotice] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<BrowserPermission>("unsupported");

  async function signOut() {
    try {
      await api("/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch (error) {
      console.error("Could not sign out cleanly.", error);
      router.replace("/login");
    }
  }

  function speakPage() {
    const speech = window.speechSynthesis;
    if (!speech) {
      window.alert("Text-to-speech is not available in this browser.");
      return;
    }
    speech.cancel();
    const text = document.querySelector("main")?.textContent?.trim();
    if (!text) {
      window.alert("There is no page text to read.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 1200));
    utterance.lang = language === "hi" ? "hi-IN" : "en-US";
    speech.speak(utterance);
  }

  async function allowBrowserNotifications() {
    setSettingsError("");
    setSettingsNotice("");
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    if (Notification.permission !== "default") {
      setNotificationPermission(Notification.permission);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not request browser notification permission.");
    }
  }

  async function saveProfile() {
    setSettingsError("");
    setSettingsNotice("");
    setProfileBusy(true);
    try {
      const updated = await api<{ name: string }>("/account/profile", {
        method: "PUT",
        body: JSON.stringify({ full_name: profileName }),
      });
      setProfileName(updated.name);
      onProfileUpdated(updated.name);
      setSettingsNotice(t("profileSaved"));
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not update your profile.");
    } finally {
      setProfileBusy(false);
    }
  }

  const permissionLabel: Record<BrowserPermission, string> = {
    granted: t("permissionGranted"),
    denied: t("permissionDenied"),
    default: t("permissionDefault"),
    unsupported: t("permissionUnsupported"),
  };

  return (
    <>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: "1px solid", borderBottomColor: "divider" }}>
        <Toolbar sx={{ gap: 2, flexWrap: "wrap", py: 1 }}>
          <Box sx={{ flexGrow: 1, minWidth: 140 }}>
            <Typography variant="h6" color="primary.dark" sx={{ fontWeight: 800 }}>{t("brand")}</Typography>
            <Typography variant="caption" color="text.secondary">{t("subtitle")}</Typography>
          </Box>
          <Chip label={t(role)} color="primary" variant="outlined" />
          <Typography variant="body2" sx={{ display: { xs: "none", sm: "block" } }}>{name}</Typography>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
            <IconButton
              aria-label={t("settings")}
              color="primary"
              onClick={() => {
                setProfileName(name);
                setSettingsError("");
                setSettingsNotice("");
                setNotificationPermission("Notification" in window ? Notification.permission : "unsupported");
                setSettingsOpen(true);
              }}
            >
              <SettingsOutlined />
            </IconButton>
            <Button size="small" color="inherit" onClick={signOut}>{t("signOut")}</Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Box component="main">{children}</Box>
      </Container>
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("settingsTitle")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            {settingsError && <Alert severity="error">{settingsError}</Alert>}
            {settingsNotice && <Alert severity="success">{settingsNotice}</Alert>}

            <Typography variant="h6">{t("appearance")}</Typography>
            <FormControl fullWidth>
              <InputLabel id="settings-language-label">{t("language")}</InputLabel>
              <Select
                labelId="settings-language-label"
                label={t("language")}
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
              >
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="hi">हिन्दी</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="settings-theme-label">{t("theme")}</InputLabel>
              <Select
                labelId="settings-theme-label"
                label={t("theme")}
                value={darkMode ? "dark" : "light"}
                onChange={(event) => {
                  if ((event.target.value === "dark") !== darkMode) toggleDarkMode();
                }}
              >
                <MenuItem value="light">{t("lightMode")}</MenuItem>
                <MenuItem value="dark">{t("darkMode")}</MenuItem>
              </Select>
            </FormControl>

            <Divider />
            <Typography variant="h6">{t("accessibility")}</Typography>
            <FormControlLabel
              control={<Switch checked={largeText} onChange={toggleLargeText} />}
              label={t("largerText")}
            />
            <FormControlLabel
              control={<Switch checked={highContrast} onChange={toggleHighContrast} />}
              label={t("contrast")}
            />
            <Button variant="outlined" onClick={speakPage}>{t("readPage")}</Button>

            <Divider />
            <Typography variant="h6">{t("notifications")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("browserPermission")}: {permissionLabel[notificationPermission]}
            </Typography>
            {notificationPermission === "default" && (
              <Button variant="outlined" onClick={allowBrowserNotifications}>{t("enableNotifications")}</Button>
            )}
            <Alert severity="info">{t("notificationDeliveryNote")}</Alert>

            {role === "patient" && (
              <>
                <Divider />
                <Typography variant="h6">{t("reminderPreferences")}</Typography>
                <FormControl fullWidth>
                  <InputLabel id="settings-reminder-category-label">{t("defaultReminderCategory")}</InputLabel>
                  <Select
                    labelId="settings-reminder-category-label"
                    label={t("defaultReminderCategory")}
                    value={defaultReminderCategory}
                    onChange={(event) => setDefaultReminderCategory(event.target.value as typeof defaultReminderCategory)}
                  >
                    {(["routine", "medication", "appointment", "personal"] as const).map((category) => (
                      <MenuItem key={category} value={category}>{t(category)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}

            <Divider />
            <Typography variant="h6">{t("accountProfile")}</Typography>
            <TextField
              label={t("displayName")}
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              required
              slotProps={{ htmlInput: { minLength: 2, maxLength: 100 } }}
            />
            <TextField label={t("email")} value={email} disabled />
            <TextField label={t("role")} value={t(role)} disabled />
            <Button
              variant="contained"
              onClick={saveProfile}
              disabled={profileBusy || profileName.trim().length < 2 || profileName.trim() === name}
            >
              {t("saveProfile")}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>{t("cancel")}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
