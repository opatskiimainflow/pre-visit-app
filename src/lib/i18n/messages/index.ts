import type { Locale } from "../config";
import { common } from "./common";
import { auth } from "./auth";
import { patient } from "./patient";
import { doctor } from "./doctor";
import { events } from "./events";
import { admin } from "./admin";

/** All UI messages for one language. Sections keep each screen's texts together. */
export function messages(locale: Locale) {
  return {
    common: common[locale],
    auth: auth[locale],
    patient: patient[locale],
    doctor: doctor[locale],
    events: events[locale],
    admin: admin[locale],
  };
}

export type Messages = ReturnType<typeof messages>;
