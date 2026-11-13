import { defineMessages } from "../define";

export const events = defineMessages({
  en: {
    labels: {
      booked: "Booked",
      rescheduled: "Rescheduled",
      cancelled: "Cancelled",
      intake_submitted: "Answers sent",
      note_created: "Note created",
      note_edited: "Note edited",
      completed: "Completed",
      reopened: "Reopened",
      summary_shared: "Summary",
      rated: "Rated",
      reminder_sent: "Reminder",
    } as Record<string, string>,
    roles: { admin: "Admin", doctor: "Doctor", patient: "Patient", system: "System" } as Record<string, string>,
  },
  uk: {
    labels: {
      booked: "Запис",
      rescheduled: "Перенесення",
      cancelled: "Скасування",
      intake_submitted: "Відповіді",
      note_created: "Нотатка",
      note_edited: "Редагування",
      completed: "Завершення",
      reopened: "Відновлення",
      summary_shared: "Рекомендації",
      rated: "Оцінка",
      reminder_sent: "Нагадування",
    },
    roles: { admin: "Адмін", doctor: "Лікар", patient: "Пацієнт", system: "Система" },
  },
});
