// Minimal fake Supabase (auth + PostgREST) for render smoke tests.
// It does NOT enforce RLS — it only lets every page render with realistic data shapes.
import http from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 54321);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const CLINIC = id(100);
const USERS = {
  patient: { id: id(1), role: "patient", full_name: "Olena Kovalenko" },
  doctor: { id: id(2), role: "doctor", full_name: "Dr. Andriy Melnyk", specialty: "Family medicine" },
  admin: { id: id(3), role: "admin", full_name: "Iryna Bondar" },
};
const DOCTOR2 = { id: id(4), role: "doctor", full_name: "Dr. Oksana Petrenko", specialty: "Cardiology" };
const PATIENT2 = { id: id(5), role: "patient", full_name: "Taras Hnatyuk" };
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
  patient: { full_name: PATIENT2.full_name },
  doctor: { full_name: USERS.doctor.full_name, specialty: USERS.doctor.specialty },
  intake: n === 0 ? null : { id: id(300 + n), submitted_at: inDays(0, 7), answers: [{ question: "Why?", answer: "Pain" }] },
  note: n >= 2 ? { id: id(400 + n), content: NOTE, model: n === 2 ? "demo-rules" : "claude-haiku-5-5", created_at: inDays(0, 7), edited_at: null } : null,
  doctor_note: n === 3 ? { body: "BP 150/95" } : null,
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
        { id: id(500), position: 1, text: "What is the main reason for your visit?", kind: "long", required: true },
        { id: id(501), position: 2, text: "Chest pain?", kind: "yes_no", required: true },
        { id: id(502), position: 3, text: "Allergies?", kind: "short", required: false },
      ];
    case "appointments":
      return [0, 1, 2, 3].map((n) => appointment(n));
    case "doctor_hours":
      return [1, 2, 3, 4, 5].map((w) => ({ doctor_id: USERS.doctor.id, weekday: w, start_time: "09:00:00", end_time: "17:00:00", slot_minutes: 30 }));
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
