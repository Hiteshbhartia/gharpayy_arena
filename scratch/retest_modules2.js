import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const BASE = 'https://gharpayy-arena-api.onrender.com/api';

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@gharpayy.com', password: 'Manager@123' })
  });
  const body = await res.json();
  console.log('--- LOGIN ---');
  console.log('Status:', res.status);
  return { token: body.token, employeeId: body.user?.employeeId };
}

async function api({ method, endpoint, token, payload }) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: payload ? JSON.stringify(payload) : undefined,
  };
  const res = await fetch(`${BASE}${endpoint}`, opts);
  const json = await res.json();
  console.log(`--- ${method} ${endpoint} ---`);
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(json, null, 2));
  return { status: res.status, body: json };
}

async function run() {
  const { token, employeeId } = await login();
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  // 1️⃣ Selfie Attendance – no explicit id (let DB generate) and unique payload
  const attPayload = {
    employeeId,
    date: new Date().toISOString().split('T')[0],
    checkInAt: Date.now(),
    checkOutAt: Date.now() + 8 * 60 * 60 * 1000,
    status: 'present',
    // add a random marker for traceability
    marker: randomUUID()
  };
  const attRes = await api({ method: 'POST', endpoint: '/attendance', token, payload: attPayload });
  const attId = attRes.body._id || attRes.body.id;
  if (attId) {
    const doc = await db.collection('attendance').findOne({ _id: attId });
    console.log('--- Atlas attendance proof ---');
    console.log(JSON.stringify(doc, null, 2));
  }

  // 2️⃣ Daily Pulse – no explicit id
  const pulsePayload = {
    employeeId,
    date: new Date().toISOString().split('T')[0],
    slot: 'slot1',
    mood: 'great',
    notes: 'Launch test pulse',
    marker: randomUUID()
  };
  const pulseRes = await api({ method: 'POST', endpoint: '/pulse', token, payload: pulsePayload });
  const pulseId = pulseRes.body._id || pulseRes.body.id;
  if (pulseId) {
    const doc = await db.collection('pulseentries').findOne({ _id: pulseId });
    console.log('--- Atlas pulse proof ---');
    console.log(JSON.stringify(doc, null, 2));
  }

  // 3️⃣ Tasks – status="todo"
  const taskPayload = {
    title: 'Launch test task',
    assigneeId: employeeId,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'todo',
    marker: randomUUID()
  };
  const taskRes = await api({ method: 'POST', endpoint: '/tasks', token, payload: taskPayload });
  const taskId = taskRes.body._id || taskRes.body.id;
  if (taskId) {
    const doc = await db.collection('tasks').findOne({ _id: taskId });
    console.log('--- Atlas task proof ---');
    console.log(JSON.stringify(doc, null, 2));
  }

  await client.close();
  console.log('--- ALL RE‑TESTS COMPLETE ---');
}

run().catch(e => { console.error('Error during re‑test', e); process.exit(1); });
