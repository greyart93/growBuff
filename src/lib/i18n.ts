export type Locale = "en" | "hi";

export const LOCALES: { code: Locale; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
];

const en = {
  appName: "GrowBuff",
  tagline: "Your AI marketing team",
  nav: {
    dashboard: "Home",
    inbox: "Inbox",
    gbp: "Google",
    campaigns: "Campaigns",
    contacts: "Contacts",
    automations: "Automations",
    assistant: "Assistant",
    knowledge: "Knowledge",
    billing: "Plan",
    settings: "Settings",
    admin: "Admin",
  },
  common: {
    save: "Save",
    cancel: "Cancel",
    approve: "Approve",
    edit: "Edit",
    send: "Send",
    schedule: "Schedule",
    connect: "Connect",
    loading: "Loading…",
    retry: "Retry",
    today: "Today",
    week: "This week",
    all: "All",
    language: "Language",
    logout: "Log out",
    copy: "Copy",
    done: "Done",
    back: "Back",
    next: "Next",
  },
  dashboard: {
    greeting: "Namaste",
    summary: "This week",
    tasks: "Today's tasks",
    calls: "Calls from Google",
    leads: "New leads",
    bookings: "Bookings",
    reviews: "New reviews",
    responses: "Campaign replies",
    noTasks: "All clear. Your agents are on it.",
    askAssistant: "Ask your growth assistant",
  },
  inbox: {
    title: "Shared inbox",
    placeholder: "Type a message…",
    aiOn: "AI is replying",
    aiOff: "You are replying",
    takeOver: "Take over",
    giveBack: "Let AI reply",
    handoff: "Needs human",
    empty: "No conversations yet",
    simulate: "Simulate customer message",
  },
};

const hi: typeof en = {
  appName: "GrowBuff",
  tagline: "आपकी AI मार्केटिंग टीम",
  nav: {
    dashboard: "होम",
    inbox: "इनबॉक्स",
    gbp: "गूगल",
    campaigns: "कैंपेन",
    contacts: "ग्राहक",
    automations: "ऑटोमेशन",
    assistant: "असिस्टेंट",
    knowledge: "जानकारी",
    billing: "प्लान",
    settings: "सेटिंग्स",
    admin: "एडमिन",
  },
  common: {
    save: "सेव करें",
    cancel: "रद्द करें",
    approve: "मंज़ूर करें",
    edit: "बदलें",
    send: "भेजें",
    schedule: "शेड्यूल",
    connect: "कनेक्ट करें",
    loading: "लोड हो रहा है…",
    retry: "फिर कोशिश करें",
    today: "आज",
    week: "इस हफ़्ते",
    all: "सभी",
    language: "भाषा",
    logout: "लॉग आउट",
    copy: "कॉपी",
    done: "हो गया",
    back: "पीछे",
    next: "आगे",
  },
  dashboard: {
    greeting: "नमस्ते",
    summary: "इस हफ़्ते",
    tasks: "आज के काम",
    calls: "गूगल से कॉल",
    leads: "नए ग्राहक",
    bookings: "बुकिंग",
    reviews: "नई समीक्षाएँ",
    responses: "कैंपेन जवाब",
    noTasks: "सब ठीक है। आपके एजेंट काम कर रहे हैं।",
    askAssistant: "अपने ग्रोथ असिस्टेंट से पूछें",
  },
  inbox: {
    title: "शेयर्ड इनबॉक्स",
    placeholder: "संदेश लिखें…",
    aiOn: "AI जवाब दे रहा है",
    aiOff: "आप जवाब दे रहे हैं",
    takeOver: "खुद जवाब दें",
    giveBack: "AI को जवाब दें",
    handoff: "इंसान चाहिए",
    empty: "अभी कोई बातचीत नहीं",
    simulate: "ग्राहक का संदेश सिम्युलेट करें",
  },
};

const dictionaries = { en, hi };

export type Dictionary = typeof en;

export function t(locale: string | undefined, key: string): string {
  const dict = dictionaries[(locale as Locale) in dictionaries ? (locale as Locale) : "en"];
  const value = key.split(".").reduce<any>((acc, part) => (acc ? acc[part] : undefined), dict);
  return typeof value === "string" ? value : key;
}

export function localeTag(locale: string | undefined) {
  return locale === "hi" ? "hi-IN" : "en-IN";
}
