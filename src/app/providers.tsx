"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import type { PaletteOptions } from "@mui/material/styles";
import type { ReminderCategory } from "@/lib/api";

export type Language = "en" | "hi";

const translations: Record<Language, Record<string, string>> = {
  en: {
    brand: "ReMind",
    subtitle: "Cognitive support, with care",
    patient: "Patient",
    doctor: "Doctor",
    admin: "Admin",
    dashboard: "Dashboard",
    activities: "Activities",
    reminders: "Reminders",
    progress: "Progress",
    reports: "Reports",
    signOut: "Sign out",
    welcome: "Welcome",
    loading: "Loading your secure workspace…",
    waiting: "Waiting for doctor assignment",
    waitingDescription: "Your administrator will assign a verified doctor. You can start your baseline assessment after you review the assignment and consent to sharing.",
    reviewAssignment: "Review doctor assignment",
    consent: "I consent to sharing my ReMind assessment and activity records with this doctor.",
    accept: "Accept and continue",
    decline: "I do not consent",
    baseline: "Baseline assessment",
    baselineNotice: "Your doctor must administer an authorized MMSE and any clinician-selected assessments. This prototype does not contain test questions. Your doctor records the results here after the assessment.",
    activitiesTitle: "Your activities",
    remindersTitle: "Your reminders",
    reportsTitle: "Doctor-approved reports",
    addReminder: "Add reminder",
    createReminder: "Create reminder",
    save: "Save",
    cancel: "Cancel",
    language: "Language",
    darkMode: "Dark mode",
    lightMode: "Light mode",
    largerText: "Larger text",
    contrast: "High contrast",
    readPage: "Read this page aloud",
    settings: "Settings",
    settingsTitle: "Settings",
    appearance: "Appearance",
    theme: "Theme",
    accessibility: "Accessibility",
    notifications: "Notifications",
    browserPermission: "Browser notification permission",
    permissionGranted: "Allowed",
    permissionDenied: "Blocked in browser settings",
    permissionDefault: "Not requested",
    permissionUnsupported: "Not supported by this browser",
    enableNotifications: "Allow browser notifications",
    notificationDeliveryNote: "Scheduled notification delivery is not configured in this prototype.",
    reminderPreferences: "Reminder preferences",
    defaultReminderCategory: "Default reminder category",
    routine: "Daily routine",
    medication: "Medication",
    appointment: "Appointment",
    personal: "Personal task",
    accountProfile: "Account profile",
    displayName: "Display name",
    role: "Role",
    saveProfile: "Save profile",
    profileSaved: "Display name updated.",
    easy: "That felt easy",
    okay: "That felt okay",
    hard: "That felt difficult",
    startActivity: "Start activity",
    next: "Continue",
    answer: "Choose an answer",
    complete: "Save activity",
    score: "Score",
    saved: "Saved",
    offline: "Offline — showing saved data",
    syncPending: "Saved on this device. It will sync when you're online.",
    sync: "Sync now",
    assignedDoctor: "Assigned doctor",
    noBaseline: "Your doctor will record your baseline assessment here.",
    demoOnly: "Prototype only — not a diagnosis or clinical result.",
    downloadPdf: "Download PDF",
    approve: "Approve",
    reject: "Keep current plan",
    adminAssignment: "Patient-doctor assignments",
    createDoctor: "Create verified doctor account",
    registeredPatients: "Registered patients",
    verifiedDoctors: "Verified doctors",
    unassignedPatients: "Unassigned patients",
    assign: "Assign doctor",
    noClinicalAccess: "Admin view contains account and assignment details only. Clinical records are not accessible here.",
    verifyCredentials: "I checked this doctor's professional credentials",
    verificationNote: "Credential verification note",
    doctorName: "Doctor name",
    email: "Email",
    password: "Password",
    fullName: "Full name",
    register: "Create patient account",
    signIn: "Sign in",
    registerFirst: "New to ReMind? Register first.",
    alreadyAccount: "Already registered? Sign in.",
  },
  hi: {
    brand: "ReMind",
    subtitle: "देखभाल के साथ संज्ञानात्मक सहायता",
    patient: "मरीज़",
    doctor: "डॉक्टर",
    admin: "प्रशासक",
    dashboard: "डैशबोर्ड",
    activities: "गतिविधियाँ",
    reminders: "रिमाइंडर",
    progress: "प्रगति",
    reports: "रिपोर्ट",
    signOut: "साइन आउट",
    welcome: "स्वागत है",
    loading: "आपका सुरक्षित कार्यक्षेत्र खुल रहा है…",
    waiting: "डॉक्टर के आवंटन की प्रतीक्षा",
    waitingDescription: "प्रशासक आपके लिए सत्यापित डॉक्टर नियुक्त करेंगे। नियुक्ति देखने और सहमति देने के बाद आप प्रारंभिक मूल्यांकन शुरू कर सकते हैं।",
    reviewAssignment: "डॉक्टर की नियुक्ति देखें",
    consent: "मैं अपने ReMind मूल्यांकन और गतिविधि रिकॉर्ड इस डॉक्टर के साथ साझा करने की सहमति देता/देती हूँ।",
    accept: "स्वीकार करें और जारी रखें",
    decline: "मैं सहमति नहीं देता/देती",
    baseline: "प्रारंभिक मूल्यांकन",
    baselineNotice: "आपके डॉक्टर को अधिकृत MMSE और चिकित्सक द्वारा चुने गए मूल्यांकन करने होंगे। इस प्रोटोटाइप में परीक्षण के प्रश्न शामिल नहीं हैं। मूल्यांकन के बाद डॉक्टर यहाँ परिणाम दर्ज करेंगे।",
    activitiesTitle: "आपकी गतिविधियाँ",
    remindersTitle: "आपके रिमाइंडर",
    reportsTitle: "डॉक्टर द्वारा स्वीकृत रिपोर्ट",
    addReminder: "रिमाइंडर जोड़ें",
    createReminder: "रिमाइंडर बनाएँ",
    save: "सहेजें",
    cancel: "रद्द करें",
    language: "भाषा",
    darkMode: "डार्क मोड",
    lightMode: "लाइट मोड",
    largerText: "बड़ा पाठ",
    contrast: "उच्च कंट्रास्ट",
    readPage: "यह पृष्ठ सुनें",
    settings: "सेटिंग",
    settingsTitle: "सेटिंग",
    appearance: "दिखावट",
    theme: "थीम",
    accessibility: "सुगम्यता",
    notifications: "सूचनाएँ",
    browserPermission: "ब्राउज़र सूचना अनुमति",
    permissionGranted: "अनुमति दी गई",
    permissionDenied: "ब्राउज़र सेटिंग में अवरुद्ध",
    permissionDefault: "अनुरोध नहीं किया गया",
    permissionUnsupported: "यह ब्राउज़र समर्थित नहीं करता",
    enableNotifications: "ब्राउज़र सूचनाओं की अनुमति दें",
    notificationDeliveryNote: "इस प्रोटोटाइप में निर्धारित सूचना वितरण उपलब्ध नहीं है।",
    reminderPreferences: "रिमाइंडर प्राथमिकताएँ",
    defaultReminderCategory: "डिफ़ॉल्ट रिमाइंडर श्रेणी",
    routine: "दैनिक दिनचर्या",
    medication: "दवा",
    appointment: "मुलाक़ात",
    personal: "व्यक्तिगत कार्य",
    accountProfile: "खाता प्रोफ़ाइल",
    displayName: "प्रदर्शन नाम",
    role: "भूमिका",
    saveProfile: "प्रोफ़ाइल सहेजें",
    profileSaved: "प्रदर्शन नाम अपडेट किया गया।",
    easy: "यह आसान लगा",
    okay: "यह ठीक लगा",
    hard: "यह कठिन लगा",
    startActivity: "गतिविधि शुरू करें",
    next: "जारी रखें",
    answer: "उत्तर चुनें",
    complete: "गतिविधि सहेजें",
    score: "स्कोर",
    saved: "सहेजा गया",
    offline: "ऑफ़लाइन — सहेजा गया डेटा दिख रहा है",
    syncPending: "इस डिवाइस पर सहेजा गया। ऑनलाइन होने पर सिंक होगा।",
    sync: "अभी सिंक करें",
    assignedDoctor: "नियुक्त डॉक्टर",
    noBaseline: "आपके डॉक्टर यहाँ प्रारंभिक मूल्यांकन दर्ज करेंगे।",
    demoOnly: "केवल प्रोटोटाइप — निदान या चिकित्सीय परिणाम नहीं।",
    downloadPdf: "PDF डाउनलोड करें",
    approve: "स्वीकृत करें",
    reject: "वर्तमान योजना रखें",
    adminAssignment: "मरीज़-डॉक्टर नियुक्तियाँ",
    createDoctor: "सत्यापित डॉक्टर खाता बनाएँ",
    registeredPatients: "पंजीकृत मरीज़",
    verifiedDoctors: "सत्यापित डॉक्टर",
    unassignedPatients: "अनियुक्त मरीज़",
    assign: "डॉक्टर नियुक्त करें",
    noClinicalAccess: "प्रशासक केवल खाता और नियुक्ति विवरण देख सकते हैं। यहाँ चिकित्सीय रिकॉर्ड उपलब्ध नहीं हैं।",
    verifyCredentials: "मैंने डॉक्टर की व्यावसायिक योग्यताएँ जाँची हैं",
    verificationNote: "योग्यता सत्यापन टिप्पणी",
    doctorName: "डॉक्टर का नाम",
    email: "ईमेल",
    password: "पासवर्ड",
    fullName: "पूरा नाम",
    register: "मरीज़ खाता बनाएँ",
    signIn: "साइन इन",
    registerFirst: "ReMind पर नए हैं? पहले पंजीकरण करें।",
    alreadyAccount: "पहले से पंजीकृत हैं? साइन इन करें।",
  },
};

interface SettingsValue {
  language: Language;
  setLanguage: (language: Language) => void;
  defaultReminderCategory: ReminderCategory;
  setDefaultReminderCategory: (category: ReminderCategory) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  largeText: boolean;
  toggleLargeText: () => void;
  highContrast: boolean;
  toggleHighContrast: () => void;
  t: (key: string) => string;
}

const SettingsContext = createContext<SettingsValue | null>(null);

const PREFERENCE_EVENT = "remind-preferences-change";
const PREFERENCE_KEYS = [
  "remind-language",
  "remind-dark-mode",
  "remind-large-text",
  "remind-high-contrast",
  "remind-default-reminder-category",
] as const;

interface Preferences {
  language: Language;
  defaultReminderCategory: ReminderCategory;
  darkMode: boolean;
  largeText: boolean;
  highContrast: boolean;
}

function subscribeToPreferences(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PREFERENCE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PREFERENCE_EVENT, onChange);
  };
}

function getPreferencesSnapshot(): string {
  return JSON.stringify(PREFERENCE_KEYS.map((key) => window.localStorage.getItem(key)));
}

function parsePreferences(snapshot: string): Preferences {
  try {
    const values = JSON.parse(snapshot) as Array<string | null>;
    return {
      language: values[0] === "hi" ? "hi" : "en",
      darkMode: values[1] === "true",
      largeText: values[2] === "true",
      highContrast: values[3] === "true",
      defaultReminderCategory: values[4] === "medication" || values[4] === "appointment" || values[4] === "personal"
        ? values[4]
        : "routine",
    };
  } catch {
    return {
      language: "en",
      defaultReminderCategory: "routine",
      darkMode: false,
      largeText: false,
      highContrast: false,
    };
  }
}

function createAppTheme(darkMode: boolean, highContrast: boolean) {
  const palette: PaletteOptions = darkMode
    ? {
        mode: "dark",
        primary: highContrast
          ? { main: "#b8ffdf", dark: "#75e1b4", light: "#e1fff1", contrastText: "#000000" }
          : { main: "#8bc8b2", dark: "#6fb09a", light: "#27483e", contrastText: "#102019" },
        secondary: { main: "#f0ac7e" },
        background: { default: highContrast ? "#000000" : "#121a18", paper: highContrast ? "#050505" : "#1d2825" },
        text: { primary: highContrast ? "#ffffff" : "#edf3f0", secondary: highContrast ? "#f1f1f1" : "#bbc9c3" },
        divider: highContrast ? "#ffffff" : "#3a4944",
        success: { main: "#72c995" },
        warning: { main: "#f0bd63" },
      }
    : {
        mode: "light",
        primary: highContrast
          ? { main: "#004c3f", dark: "#00352b", light: "#d2f2e7", contrastText: "#ffffff" }
          : { main: "#356b62", dark: "#214c45", light: "#dcebe6" },
        secondary: { main: "#d69068" },
        background: { default: "#f6f7f4", paper: "#ffffff" },
        text: { primary: highContrast ? "#000000" : "#25332f", secondary: highContrast ? "#222222" : "#62716c" },
        divider: highContrast ? "#000000" : "#e8ece8",
        success: { main: "#39845d" },
        warning: { main: "#a86f21" },
      };

  return createTheme({
    palette,
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: '"Segoe UI", "Noto Sans Devanagari", Arial, sans-serif',
      h1: { fontWeight: 700, letterSpacing: "-0.03em" },
      h2: { fontWeight: 700, letterSpacing: "-0.02em" },
      h3: { fontWeight: 700 },
      button: { textTransform: "none", fontWeight: 650 },
    },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiCard: { styleOverrides: { root: { border: `1px solid ${palette.divider}` } } },
      MuiTextField: { defaultProps: { fullWidth: true, size: "medium" } },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeToPreferences, getPreferencesSnapshot, () => "");
  const { language, defaultReminderCategory, darkMode, largeText, highContrast } = useMemo(
    () => parsePreferences(snapshot),
    [snapshot],
  );
  const theme = useMemo(() => createAppTheme(darkMode, highContrast), [darkMode, highContrast]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.colorMode = darkMode ? "dark" : "light";
    document.documentElement.dataset.textScale = largeText ? "large" : "normal";
    document.documentElement.dataset.contrast = highContrast ? "high" : "normal";
  }, [language, darkMode, largeText, highContrast]);

  const savePreference = useCallback((key: typeof PREFERENCE_KEYS[number], value: string) => {
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
  }, []);

  const setLanguage = useCallback((value: Language) => {
    savePreference("remind-language", value);
  }, [savePreference]);
  const setDefaultReminderCategory = useCallback((value: ReminderCategory) => {
    savePreference("remind-default-reminder-category", value);
  }, [savePreference]);
  const toggleDarkMode = useCallback(() => {
    savePreference("remind-dark-mode", String(!darkMode));
  }, [darkMode, savePreference]);
  const toggleLargeText = useCallback(() => {
    savePreference("remind-large-text", String(!largeText));
  }, [largeText, savePreference]);
  const toggleHighContrast = useCallback(() => {
    savePreference("remind-high-contrast", String(!highContrast));
  }, [highContrast, savePreference]);

  const value = useMemo<SettingsValue>(
    () => ({
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
      t: (key) => translations[language][key] ?? translations.en[key] ?? key,
    }),
    [
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
    ],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
    </ThemeProvider>
  );
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used within AppProviders.");
  return value;
}
