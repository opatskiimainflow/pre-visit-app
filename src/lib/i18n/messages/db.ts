import type { Locale } from "../config";

/**
 * Messages raised by the database (errcode P0001) are written in English in the SQL.
 * This maps the ones a person can see to Ukrainian; unknown ones are shown as they are.
 */
const UK: Record<string, string> = {
  "A clinic can have at most 10 doctors in this demo": "У демо в клініці може бути не більше 10 лікарів",
  "A follow-up must belong to a yes/no question that is not a follow-up itself":
    "Уточнення може належати лише питанню «так/ні», яке саме не є уточненням",
  "A question with follow-ups must stay a yes/no question": "Питання з уточненнями має залишатися питанням «так/ні»",
  "Enter a valid date of birth": "Введіть правильну дату народження",
  "Enter the doctor": "Вкажіть лікаря",
  "Enter your full name (2–80 characters)": "Введіть ім'я та прізвище (2–80 символів)",
  "Only clinic admins can add doctors": "Додавати лікарів може лише адміністратор клініки",
  "Only patients can book a visit": "Записатися може лише пацієнт",
  "Only patients can edit these details": "Ці дані може змінювати лише пацієнт",
  "The demo clinic is not available right now": "Демо-клініка зараз недоступна",
  "The demo is full today, please use a demo role": "Демо сьогодні переповнене, скористайтеся демо-роллю",
  "This question has follow-ups, so it cannot become a follow-up": "У цього питання є уточнення, тож воно не може стати уточненням",
  "This time is no longer available": "Цей час уже зайнятий",
  "This visit can no longer be moved": "Цей візит більше не можна перенести",
  "Unknown value for sex": "Невідоме значення статі",
  "Visit not found": "Візит не знайдено",
  "You already have 5 upcoming visits": "У вас уже 5 запланованих візитів",
  "This time is outside the doctor's working hours": "Цей час поза робочими годинами лікаря",
};

/** A database message as a sentence in the UI language. */
export function dbMessage(message: string, locale: Locale) {
  const text = message.replace(/\.$/, "");
  return `${locale === "uk" ? (UK[text] ?? text) : text}.`;
}
