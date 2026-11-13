// Minimal fake Supabase (auth + PostgREST) for render smoke tests.
// It does NOT enforce RLS — it only lets every page render with realistic data shapes.
import http from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 54321);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const CLINIC = id(100);
const USERS = {
  patient: { id: id(1), role: "patient", full_name: "Olena Kovalenko", date_of_birth: "1990-03-14", sex: "female" },
  doctor: { id: id(2), role: "doctor", full_name: "Dr. Andriy Melnyk", specialty: "Family medicine" },
  admin: { id: id(3), role: "admin", full_name: "Iryna Bondar" },
};
const DOCTOR2 = { id: id(4), role: "doctor", full_name: "Dr. Oksana Petrenko", specialty: "Cardiology" };
const PATIENT2 = { id: id(5), role: "patient", full_name: "Taras Hnatyuk", date_of_birth: null, sex: null };
const profile = (p) => ({ clinic_id: CLINIC, specialty: null, active: true, ...p });

const inDays = (d, h) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + d);
  t.setUTCHours(h, 0, 0, 0);
  return t.toISOString();
};

const NOTE = {
  chief_complaint: "Headaches for 3 weeks",
  history: "Hypertension.",
  medications: ["Ibuprofen 400 mg"],
  allergies: ["Penicillin"],
  red_flags: ["Frequent NSAID use"],
  questions_for_doctor: ["Duration?"],
};
const appointment = (n, extra = {}) => ({
  id: id(200 + n),
  clinic_id: CLINIC,
  scheduled_at: inDays(n % 2, 8 + n),
  reason: "Headaches",
  status: n === 3 ? "completed" : "scheduled",
  completed_at: n === 3 ? inDays(0, 12) : null,
  patient_id: PATIENT2.id,
  doctor_id: USERS.doctor.id,
  patient: { full_name: PATIENT2.full_name, date_of_birth: "1982-07-02", sex: "male" },
  doctor: { id: USERS.doctor.id, full_name: USERS.doctor.full_name, specialty: USERS.doctor.specialty },
  intake: n === 0 ? null : { id: id(300 + n), submitted_at: inDays(0, 7), answers: [{ question: "Why?", answer: "Pain" }] },
  note: n >= 2 ? { id: id(400 + n), content: NOTE, model: n === 2 ? "demo-rules" : "claude-haiku-5-5", created_at: inDays(0, 7), edited_at: null } : null,
  doctor_note: n === 3 ? { body: "BP 150/95" } : null,
  summary: n === 3 ? { body: "Rest and fluids.\n• Come back in 2 weeks", updated_at: inDays(0, 13) } : null,
  rating: n === 3 ? { stars: 4, comment: "Very attentive" } : null,
  ...extra,
});

function rows(table) {
  switch (table) {
    case "profiles":
      return [USERS.patient, USERS.doctor, USERS.admin, DOCTOR2, PATIENT2].map(profile);
    case "clinics":
      return [{ id: CLINIC, name: "Sunrise Family Clinic" }];
    case "questions":
      return [
        { id: id(500), position: 1, text: "What is the main reason for your visit?", text_uk: "Яка основна причина вашого візиту?", kind: "long", required: true, parent_id: null, prefill: null },
        { id: id(501), position: 2, text: "Chest pain?", text_uk: "Біль у грудях?", kind: "yes_no", required: true, parent_id: null, prefill: null },
        { id: id(503), position: 4, text: "What happened?", text_uk: null, kind: "long", required: true, parent_id: id(501), prefill: null },
        { id: id(502), position: 3, text: "Allergies?", text_uk: "Алергії?", kind: "short", required: false, parent_id: null, prefill: "allergies" },
      ];
    case "medical_cards":
      return [{ patient_id: USERS.patient.id, allergies: "None", medications: "Salbutamol inhaler", conditions: "Mild asthma", updated_at: inDays(-2, 9) }];
    case "doctor_time_off":
      return [{ id: id(600), doctor_id: USERS.doctor.id, start_date: inDays(2, 0).slice(0, 10), end_date: inDays(3, 0).slice(0, 10), note: "Conference" }];
    case "visit_ratings":
      return [5, 4, 5, 3].map((stars, i) => ({
        stars,
        comment: i % 2 ? "" : "Clear advice, thank you",
        created_at: inDays(-i - 1, 10),
        appointment: { doctor_id: i % 2 ? DOCTOR2.id : USERS.doctor.id, patient: { full_name: PATIENT2.full_name } },
      }));
    case "appointments":
      return [0, 1, 2, 3].map((n) => appointment(n));
    case "doctor_hours":
      return [
        ...[1, 2, 3, 4, 5].map((w) => ({ doctor_id: USERS.doctor.id, weekday: w, start_time: "09:00:00", end_time: "17:00:00", slot_minutes: 30 })),
        ...[2, 4].map((w) => ({ doctor_id: DOCTOR2.id, weekday: w, start_time: "10:00:00", end_time: "16:00:00", slot_minutes: 30 })),
      ];
    case "appointment_events":
      return ["booked", "intake_submitted", "note_created", "rescheduled", "completed", "cancelled", "summary_shared", "rated", "reminder_sent"].map((action, i) => ({
        id: i + 1,
        appointment_id: id(201),
        patient_id: PATIENT2.id,
        doctor_id: USERS.doctor.id,
        actor_name: i % 2 ? "Taras Hnatyuk" : "Iryna Bondar",
        actor_role: i % 2 ? "patient" : "admin",
        action,
        patient_name: PATIENT2.full_name,
        doctor_name: USERS.doctor.full_name,
        scheduled_at: inDays(1, 9),
        details: action === "rescheduled" ? { from: inDays(1, 8), to: inDays(1, 9) } : action === "rated" ? { stars: 5 } : { reason: "Headaches" },
        created_at: inDays(-i, 10),
      }));
    default:
      return [];
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const token = (req.headers.authorization ?? "").replace("Bearer ", "");
  const role = token.startsWith("role-") ? token.slice(5) : null;
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === "/auth/v1/user") {
    const u = USERS[role];
    return u ? send(200, { id: u.id, aud: "authenticated", role: "authenticated", email: `${role}@demo.previsit.app` }) : send(401, { msg: "no user" });
  }
  if (url.pathname.startsWith("/auth/v1/")) return send(200, {});

  if (url.pathname === "/rest/v1/rpc/free_slots") return send(200, [inDays(1, 9), inDays(1, 10)]);
  if (url.pathname.startsWith("/rest/v1/rpc/")) return send(200, id(999));

  const table = url.pathname.replace("/rest/v1/", "");
  if (req.method !== "GET") return send(201, []);

  let data = rows(table);
  // Richer, deterministic history for the analytics dashboard and the week calendar.
  const sel = url.searchParams.get("select") ?? "";
  if (table === "appointments" && (sel.replace(/\s/g, "").includes("doctor_id,intake") || sel.replace(/\s/g, "").includes("note:notes(id),intake"))) {
    data = [];
    for (let d = -60; d <= 8; d++) {
      const n = d < 0 ? 1 + ((d * 7 + 100) % 3) + Math.floor((d + 60) / 20) : 1 + ((d + 9) % 3);
      for (let k = 0; k < n; k++) {
        const t = new Date();
        t.setUTCDate(t.getUTCDate() + d);
        t.setUTCHours(7 + k * 2, 0, 0, 0);
        if ([0, 6].includes(t.getUTCDay())) continue;
        const past = t < new Date();
        data.push({
          id: `00000000-0000-4000-9000-${String((d + 100) * 10 + k).padStart(12, "0")}`,
          scheduled_at: t.toISOString(),
          status: past ? "completed" : "scheduled",
          doctor_id: k % 3 === 2 ? DOCTOR2.id : USERS.doctor.id,
          reason: "Check-up",
          patient: { full_name: ["Taras Hnatyuk", "Maria Shevchuk", "Petro Lysenko", "Anna Moroz"][(d + k + 60) % 4] },
          note: (d + k) % 3 === 0 ? { id: "n" } : null,
          intake: (d + k) % 5 !== 0 ? { id: "i" } : null,
        });
      }
    }
  }
  // Honour simple eq filters (?id=eq.x, ?role=eq.doctor) so .single() gets the right row.
  for (const [k, v] of url.searchParams) {
    if (typeof v === "string" && v.startsWith("eq.") && !["select", "order", "limit"].includes(k)) {
      const val = v.slice(3);
      data = data.filter((r) => r[k] === undefined || String(r[k]) === val);
    }
  }
  const wantsOne = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  if (wantsOne) return data[0] ? send(200, data[0]) : send(406, { code: "PGRST116", message: "no rows" });
  return send(200, data);
});

server.listen(PORT, "127.0.0.1", () => console.log(`stub supabase on :${PORT}`));
