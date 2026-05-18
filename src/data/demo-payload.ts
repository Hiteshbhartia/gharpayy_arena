/**
 * Canonical demo org payload — used to seed MongoDB via POST /api/migrate/seed-demo-data.
 * Values mirror src/data/seed.ts and module seeds at runtime.
 */
import {
  EMPLOYEES,
  SEED_TASKS,
  SEED_LEAVES,
  SEED_KUDOS,
  SEED_CAL,
  SEED_NOTIFS,
  SEED_ONE_ON_ONES,
  SEED_CANDIDATES,
} from "@/data/seed";
import type { Employee } from "@/types/hr";
import type { AttEvent } from "@/lib/attendance-store";

function buildAttendanceSeedEvents(): AttEvent[] {
  const today = new Date();
  today.setHours(9, 32, 0, 0);
  const t1 = today.getTime();
  return [
    { id: "ae1", employeeId: "e1", kind: "clock_in", ts: t1, lat: 19.0596, lng: 72.8295, accuracy: 12, address: "Bandra West, Mumbai", selfie: null },
    { id: "ae2", employeeId: "e2", kind: "clock_in", ts: t1 + 6 * 60_000, lat: 19.0596, lng: 72.8295, accuracy: 14, address: "Bandra West, Mumbai", selfie: null },
    { id: "ae3", employeeId: "e2", kind: "break_start", ts: t1 + 130 * 60_000, lat: 19.0596, lng: 72.8295, accuracy: 14, address: "Bandra West, Mumbai", selfie: null },
    { id: "ae4", employeeId: "e2", kind: "break_end", ts: t1 + 160 * 60_000, lat: 19.0596, lng: 72.8295, accuracy: 14, address: "Bandra West, Mumbai", selfie: null },
    { id: "ae5", employeeId: "e4", kind: "clock_in", ts: t1 - 5 * 60_000, lat: 19.076, lng: 72.8777, accuracy: 9, address: "HQ, Lower Parel, Mumbai", selfie: null },
    { id: "ae6", employeeId: "e7", kind: "clock_in", ts: t1 + 22 * 60_000, lat: 19.1197, lng: 72.8468, accuracy: 22, address: "Andheri West, Mumbai", selfie: null },
    { id: "ae7", employeeId: "e7", kind: "field_start", ts: t1 + 95 * 60_000, lat: 19.128, lng: 72.8315, accuracy: 18, address: "Versova, Andheri West", selfie: null },
  ];
}

function buildFlySeeds() {
  const today = () => new Date().toISOString().slice(0, 10);
  const hoursAgo = (h: number) => Date.now() - h * 3600 * 1000;
  return {
    flyUpdates: [
      { id: "u1", authorId: "e3", date: today(), connectedCalls: 22, visitsScheduled: 6, visitsCompleted: 4, hotLeads: 3, bookings: 1, blocker: "Owner not picking up at Brook Luxe — token pending", propertyIssue: "WiFi flaky at Aeris Boys block B", tomorrowPriority: "Close Brook Luxe token + visit 2 Whitefield parents", zone: "Whitefield", createdAt: hoursAgo(2) },
      { id: "u2", authorId: "e6", date: today(), connectedCalls: 0, visitsScheduled: 5, visitsCompleted: 5, hotLeads: 2, bookings: 0, blocker: "Cab cancelled for 4pm slot, rebooked but visit slipped 40m", propertyIssue: "Geyser dead at Oryn Girls room 304", tomorrowPriority: "First batch of 3 morning tours back-to-back", zone: "Bandra", createdAt: hoursAgo(3) },
      { id: "u3", authorId: "e7", date: today(), connectedCalls: 31, visitsScheduled: 4, visitsCompleted: 3, hotLeads: 4, bookings: 2, blocker: "Two parents want callback after 9pm — outside shift", propertyIssue: "", tomorrowPriority: "Parent callbacks 9–10pm + reassign cold leads", zone: "Andheri", createdAt: hoursAgo(1) },
      { id: "u4", authorId: "e5", date: today(), connectedCalls: 12, visitsScheduled: 2, visitsCompleted: 1, hotLeads: 1, bookings: 0, blocker: "Struggling with parent objections on deposit", propertyIssue: "", tomorrowPriority: "Shadow Karan on 3 calls + reattempt Bellandur lead", zone: "Andheri", createdAt: hoursAgo(5) },
    ],
    flyRetro: [
      { id: "r1", kind: "start", authorId: "e2", body: "Faster parent callbacks — within 15 min of enquiry", createdAt: hoursAgo(20), upvotes: ["e3", "e6", "e7", "e4"], comments: [{ id: "rc1", authorId: "e4", body: "Agreed. Will set SLA timer.", ts: hoursAgo(18) }] },
      { id: "r2", kind: "start", authorId: "e4", body: "Evening 7–9pm follow-up batch for working parents", createdAt: hoursAgo(15), upvotes: ["e2", "e3"], comments: [] },
      { id: "r3", kind: "stop", authorId: "e6", body: "Delayed visit confirmations — losing 1 in 4", createdAt: hoursAgo(22), upvotes: ["e2", "e3", "e5", "e7", "e4"], comments: [{ id: "rc2", authorId: "e2", body: "Confirm within 30 min, no exceptions.", ts: hoursAgo(21) }] },
      { id: "r4", kind: "stop", authorId: "e7", body: "Showing rooms that are already booked / on hold", createdAt: hoursAgo(10), upvotes: ["e6", "e2", "e5"], comments: [] },
      { id: "r5", kind: "continue", authorId: "e2", body: "Brook Luxe conversion script — 38% close rate this week", createdAt: hoursAgo(12), upvotes: ["e3", "e7", "e4", "e6"], comments: [] },
      { id: "r6", kind: "continue", authorId: "e3", body: "Quick WhatsApp follow-up with photos within 5 min of visit", createdAt: hoursAgo(8), upvotes: ["e6", "e7"], comments: [] },
    ],
    flyFeed: [
      { id: "f1", kind: "visit", authorId: "e6", zone: "Whitefield", property: "Brook Luxe", body: "3 visits completed at Brook Luxe — 2 strong intents", ts: hoursAgo(1.5), upvotes: ["e2", "e7"], comments: [] },
      { id: "f2", kind: "lead", authorId: "e3", zone: "Whitefield", property: "Brook Luxe", body: "Hot lead pending token — parent wants call before EOD", ts: hoursAgo(2), upvotes: ["e2"], comments: [{ id: "fc1", authorId: "e2", body: "Take it. I'll back you up.", ts: hoursAgo(1.8) }] },
      { id: "f3", kind: "issue", authorId: "e6", zone: "Bandra", property: "Aeris Boys", body: "WiFi issue raised at Aeris Boys — 6 tenants complaining", ts: hoursAgo(3), upvotes: ["e4", "e2", "e7", "e3"], comments: [] },
      { id: "f4", kind: "callback", authorId: "e7", zone: "Andheri", property: "Bellandur Hub", body: "Parent callback requested for Bellandur lead", ts: hoursAgo(0.5), upvotes: [], comments: [] },
      { id: "f5", kind: "booking", authorId: "e7", zone: "Andheri", property: "Aeris Boys", body: "Booking confirmed — token received ₹15k", ts: hoursAgo(4), upvotes: ["e2", "e4", "e6", "e3", "e5"], comments: [] },
      { id: "f6", kind: "win", authorId: "e2", zone: "All", body: "Team crossed 12 visits before lunch — best Tuesday this month", ts: hoursAgo(5), upvotes: ["e3", "e7", "e6", "e4", "e5"], comments: [] },
      { id: "f7", kind: "blocker", authorId: "e5", zone: "Andheri", body: "Stuck on deposit objection on 2 calls back-to-back — need script help", ts: hoursAgo(6), upvotes: ["e2"], comments: [{ id: "fc2", authorId: "e2", body: "Use the 'split-pay' line. I'll DM the script.", ts: hoursAgo(5.5) }] },
    ],
  };
}

function employeeToApiDoc(emp: Employee) {
  return {
    id: emp.id,
    name: emp.name,
    role: emp.role,
    title: emp.role,
    managerId: emp.managerId ?? undefined,
    hubId: emp.team,
    profile: emp,
  };
}

function candidateToApiDoc(c: (typeof SEED_CANDIDATES)[0]) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    role: c.roleApplied,
    source: c.source,
    recruiterId: c.recruiterId,
    stage: c.stage,
    rejectReason: c.rejectReason,
    appliedAt: c.appliedAt,
    notes: c.notes,
    payload: c,
  };
}

function oneOnOneToApiDoc(o: (typeof SEED_ONE_ON_ONES)[0]) {
  const status = o.status === "skipped" ? "cancelled" : o.status;
  return {
    id: o.id,
    managerId: o.managerId,
    reportId: o.reportId,
    scheduledAt: o.scheduledAt,
    durationMin: o.durationMin,
    status,
    sentiment: o.sentiment,
    agenda: o.agenda,
    notes: o.notes,
    privateNotes: o.privateNotes,
    actionItems: o.actionItems.map((a) => ({
      id: a.id,
      text: a.title,
      title: a.title,
      ownerId: a.ownerId,
      dueAt: a.dueAt,
      done: a.done,
    })),
    payload: o,
  };
}

/** Flatten calendar seed (resolve EMPLOYEES refs in withIds). */
function calendarToApi() {
  return SEED_CAL.map((ev) => ({
    ...ev,
    withIds: ev.withIds,
  }));
}

export function buildDemoPayload() {
  const fly = buildFlySeeds();
  return {
    employees: EMPLOYEES.map(employeeToApiDoc),
    tasks: SEED_TASKS,
    leaves: SEED_LEAVES,
    kudos: SEED_KUDOS,
    calendar: calendarToApi(),
    notifications: SEED_NOTIFS,
    oneOnOnes: SEED_ONE_ON_ONES.map(oneOnOneToApiDoc),
    recruiting: SEED_CANDIDATES.map(candidateToApiDoc),
    attendanceEvents: buildAttendanceSeedEvents(),
    pulse: [] as unknown[],
    flyUpdates: fly.flyUpdates,
    flyRetro: fly.flyRetro,
    flyFeed: fly.flyFeed,
    consoleDays: [] as unknown[],
  };
}
