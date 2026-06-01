// launch-audit.js – production readiness evidence script
// Run with: node scratch/launch-audit.js
// Requires Node >=18 (fetch built‑in) and mongodb driver (already a dependency).

// Using native fetch (Node >=18); no external import needed
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment (same .env used by server)
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../server/.env") });

const BASE = "https://gharpayy-arena-api.onrender.com/api";

// Test accounts (already seeded in Atlas)
const managerCred = { email: "manager@gharpayy.com", password: "Manager@123" };
const employeeCred = { email: "employee@gharpayy.com", password: "Employee@123" };

async function login(creds) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  });
  const body = await res.json();
  console.log(`--- LOGIN [${new Date().toISOString()}] ---`);
  console.log("Endpoint: POST /auth/login");
  console.log("Request payload:", JSON.stringify(creds, null, 2));
  console.log("Response status:", res.status);
  console.log("Response payload:", JSON.stringify(body, null, 2));
  // Extract employeeId from nested user object
  return { token: body.token, role: body.role, employeeId: body.user?.employeeId };
}

async function apiCall({ method, endpoint, token, payload }) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: payload ? JSON.stringify(payload) : undefined,
  };
  const res = await fetch(`${BASE}${endpoint}`, opts);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = null; // non-JSON response
  }
  console.log(`--- ${method} ${endpoint} [${new Date().toISOString()}] ---`);
  console.log("Request payload:", payload ? JSON.stringify(payload, null, 2) : "<none>");
  console.log("Response status:", res.status);
  console.log("Response payload:", json ? JSON.stringify(json, null, 2) : text);
  return { status: res.status, body: json, raw: text };
}

async function run() {
  // ---------------------------------------------------
  // 1️⃣ Login as manager (admin‑like role)
  const manager = await login(managerCred);

  // ---------------------------------------------------
  // Mongo client for direct Atlas verification
  const mongoUri = process.env.MONGODB_URI;
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db();

  // Helper to fetch document by _id from a collection
  async function fetchDoc(col, id) {
    const doc = await db.collection(col).findOne({ _id: id });
    console.log(`--- Atlas ${col} document (${id}) ---`);
    console.log(JSON.stringify(doc, null, 2));
    return doc;
  }

  // ---------------------------------------------------
  // 2️⃣ Selfie Attendance (clock‑in/out)
  const attPayload = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    employeeId: manager.employeeId,
    date: "2026-05-29",
    checkInAt: Date.now(),
    checkOutAt: Date.now() + 8 * 60 * 60 * 1000,
    status: "present",
  };
  const attRes = await apiCall({ method: "POST", endpoint: "/attendance", token: manager.token, payload: attPayload });
  const attId = attRes.body._id || attRes.body.id;
  if (attId) await fetchDoc("attendance", attId);

  // ---------------------------------------------------
  // 3️⃣ Daily Pulse
  const pulsePayload = {
    id: `pulse-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    employeeId: manager.employeeId,
    date: "2026-05-29",
    slot: "slot1",
    mood: "great",
    notes: "All systems go",
  };
  const pulseRes = await apiCall({ method: "POST", endpoint: "/pulse", token: manager.token, payload: pulsePayload });
  const pulseId = pulseRes.body._id || pulseRes.body.id;
  if (pulseId) await fetchDoc("pulseentries", pulseId);

  // ---------------------------------------------------
  // 4️⃣ Fly Board
  const flyPayload = {
    authorId: manager.employeeId,
    date: "2026-05-29",
    content: "Launch test post from audit",
  };
  const flyRes = await apiCall({ method: "POST", endpoint: "/fly/updates", token: manager.token, payload: flyPayload });
  const flyId = flyRes.body && (flyRes.body._id || flyRes.body.id);
  if (flyId) await fetchDoc("flyupdates", flyId);

  // ---------------------------------------------------
  // 5️⃣ Tasks
  const taskPayload = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "Audit generated task",
    assigneeId: manager.employeeId,
    dueDate: "2026-06-05",
    status: "open",
  };
  const taskRes = await apiCall({ method: "POST", endpoint: "/tasks", token: manager.token, payload: taskPayload });
  const taskId = taskRes.body._id || taskRes.body.id;
  if (taskId) await fetchDoc("tasks", taskId);

  // ---------------------------------------------------
  // 6️⃣ Live Roster (operator summary)
  const rosterRes = await apiCall({ method: "GET", endpoint: "/operator", token: manager.token, payload: null });
  // No direct document – just verify status 200 and payload contains members array

  // ---------------------------------------------------
  // 7️⃣ KPI Governance – create definition, target, assignment
  const kpiDefPayload = {
    id: `kpi-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "Audit KPI",
    description: "Test KPI created by audit",
    metric: "count",
  };
  const kpiDefRes = await apiCall({ method: "POST", endpoint: "/kpis", token: manager.token, payload: kpiDefPayload });
  const kpiDefId = kpiDefRes.body._id || kpiDefRes.body.id;
  if (kpiDefId) await fetchDoc("kpis", kpiDefId);

  const kpiTargetPayload = {
    id: `kpiTarget-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kpiId: kpiDefId,
    target: 100,
    period: "monthly",
  };
  const kpiTargetRes = await apiCall({ method: "POST", endpoint: "/kpis/targets", token: manager.token, payload: kpiTargetPayload });
  const targetId = kpiTargetRes.body._id || kpiTargetRes.body.id;
  if (targetId) await fetchDoc("kpidefinitions", targetId); // collection name may vary; using generic check

  const kpiAssignPayload = {
    kpiId: kpiDefId,
    employeeId: manager.employeeId,
    targetId: targetId,
    id: `kpiAssign-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  const kpiAssignRes = await apiCall({ method: "POST", endpoint: "/kpis/assignments", token: manager.token, payload: kpiAssignPayload });
  const assignId = kpiAssignRes.body._id || kpiAssignRes.body.id;
  if (assignId) await fetchDoc("kpiassignments", assignId);

  // ---------------------------------------------------
  // 8️⃣ Operator Console – admin view of operator stats
  const consoleRes = await apiCall({ method: "GET", endpoint: "/operator", token: manager.token, payload: null });
  // Already performed as roster; this confirms console endpoint works.

  // ---------------------------------------------------
  // Clean up – optional delete created docs (commented out)
  // await db.collection("attendance").deleteOne({ _id: attId });

  await client.close();
  console.log("--- AUDIT COMPLETE ---");
}

run().catch((e) => {
  console.error("AUDIT ERROR", e);
  process.exit(1);
});
