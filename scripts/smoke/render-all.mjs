// Renders every page as every role against the stub and fails on any server error.
// Usage: node scripts/smoke/render-all.mjs http://127.0.0.1:3100
const BASE = process.argv[2] ?? "http://127.0.0.1:3100";
const STORAGE_KEY = "sb-127-auth-token"; // derived from the stub URL host (127.0.0.1)

function cookieFor(role) {
  const session = {
    access_token: `role-${role}`,
    refresh_token: "stub",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "stub", aud: "authenticated" },
  };
  return `${STORAGE_KEY}=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}

const D1 = "00000000-0000-4000-8000-000000000002";
const A1 = "00000000-0000-4000-8000-000000000201";
const A3 = "00000000-0000-4000-8000-000000000203";
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const PAGES = {
  anon: ["/login", "/signup", "/forgot-password", "/forgot-password?expired=1", "/reset-password", "/"],
  patient: ["/patient", "/patient?booked=1", "/patient?welcome=1", "/patient?moved=1", `/patient/reschedule/${A1}`, "/patient/book", `/patient/book?doctor=${D1}`, `/patient/book?doctor=${D1}&day=${tomorrow}`, `/patient/visit/00000000-0000-4000-8000-000000000200`],
  doctor: ["/doctor", "/doctor/calendar", "/doctor/calendar?week=2026-11-02", `/doctor/appointment/${A1}`, `/doctor/appointment/${A3}`, "/doctor/appointment/00000000-0000-4000-8000-000000000202"],
  admin: ["/admin", "/admin/analytics", "/admin/activity", "/admin/activity?type=note", "/admin/patients", "/admin/doctors", "/admin/questions"],
};

let failed = 0;
for (const [role, paths] of Object.entries(PAGES)) {
  for (const path of paths) {
    const res = await fetch(BASE + path, {
      headers: role === "anon" ? {} : { cookie: cookieFor(role) },
      redirect: "manual",
    });
    const body = res.status === 200 ? await res.text() : "";
    const broken = res.status >= 500 || /This page couldn.t load|Application error|digest/.test(body);
    if (broken) failed++;
    console.log(`${broken ? "FAIL" : "ok  "} ${res.status} ${role.padEnd(7)} ${path}${res.headers.get("location") ? " -> " + res.headers.get("location") : ""}`);
  }
}
if (failed) {
  console.error(`\n${failed} page(s) failed to render`);
  process.exit(1);
}
console.log("\nAll pages rendered.");
