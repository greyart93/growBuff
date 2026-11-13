export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const AUTOMATION_TYPES = [
  { type: "appointment_reminder", name: "Appointment reminder", detail: "24 hours before every booking" },
  { type: "review_request", name: "Review request", detail: "Next day after a completed visit" },
  { type: "birthday_offer", name: "Birthday offer", detail: "On the customer's birthday month" },
  { type: "win_back", name: "Win-back sequence", detail: "Customers not seen in 60 days" },
  { type: "auto_followup", name: "Chat follow-up", detail: "Nudge quiet WhatsApp conversations" },
] as const;
