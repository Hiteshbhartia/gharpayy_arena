/**
 * /api/operator — Team Intelligence analytics layer
 *
 * GET  /api/operator/team-intelligence          — full team health + member summaries
 * GET  /api/operator/member/:id/intelligence    — single member deep-dive
 *
 * Access: admin | manager | hr roles.
 * Hierarchy: results scoped to managerId chain and zone/team.
 * All arrays default to [] and objects default safely — no undefined collections.
 */

import { Router } from "express";
import {
  Employee,
  Task,
  Leave,
  AttendanceEvent,
  Kudo,
  KpiDefinition,
  KpiTarget,
  FlyUpdate,
  FlyRetro,
  FlyFeed,
} from "../models/index.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../lib/async-handler.js";
import { readProfile } from "../lib/workforce-access.js";

const router = Router();
router.use(requireAuth, requireRole("admin", "manager", "hr"));

// ─── helpers ────────────────────────────────────────────────────────────────

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

/** Return ISO YYYY-MM-DD for today and N days ago */
function dateRange(daysBack) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

/** Resolve hierarchy: returns set of employee IDs visible to the requesting user */
async function resolveVisibleIds(user, allEmployees) {
  if (user.role === "admin" || user.role === "hr") {
    return new Set(allEmployees.map((e) => e.id));
  }
  // manager: direct + indirect reports
  const actorEmpId = user.employeeId;
  if (!actorEmpId) return new Set();

  const visible = new Set();
  const queue = [actorEmpId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const e of allEmployees) {
      if (e.managerId === current && !visible.has(e.id)) {
        visible.add(e.id);
        queue.push(e.id);
      }
    }
  }
  return visible;
}

/** Compute per-member analytics from raw DB data */
function computeMemberMetrics(emp, tasks, leaves, attEvents, kudos) {
  const empTasks = safeArr(tasks).filter((t) => t.assigneeId === emp.id);
  const total = empTasks.length;
  const done = empTasks.filter((t) => t.status === "done").length;
  const overdue = empTasks.filter(
    (t) => t.status !== "done" && t.dueAt && t.dueAt < Date.now(),
  ).length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const empLeaves = safeArr(leaves).filter((l) => l.employeeId === emp.id);
  const approvedLeaves = empLeaves.filter((l) => l.status === "approved").length;
  const pendingLeaves = empLeaves.filter((l) => l.status === "pending").length;

  const empEvents = safeArr(attEvents).filter((e) => e.employeeId === emp.id);
  const clockIns = empEvents.filter((e) => e.kind === "clock_in");

  // Late arrival: clock_in ts that falls after the employee's shift start (approx 10am = 600min)
  const profile = readProfile(emp);
  const shiftStart = profile.shift ? (profile.shift.split(" - ")[0] ?? "10:00") : "10:00";
  const [shH, shM] = shiftStart.split(":").map(Number);
  const shiftStartMin = (shH || 10) * 60 + (shM || 0) + 15; // 15-min grace
  const lateArrivals = clockIns.filter((ci) => {
    const d = new Date(ci.ts);
    const min = d.getHours() * 60 + d.getMinutes();
    return min > shiftStartMin;
  });

  const punctualityPct =
    clockIns.length > 0
      ? Math.round(((clockIns.length - lateArrivals.length) / clockIns.length) * 100)
      : null;

  const empKudos = safeArr(kudos).filter((k) => k.toId === emp.id);
  const recentKudos = empKudos.filter((k) => k.ts > Date.now() - 30 * 86400_000).length;

  // Streak: consecutive days with clock_in (rough)
  const uniqueDays = [...new Set(clockIns.map((ci) => new Date(ci.ts).toISOString().slice(0, 10)))];
  uniqueDays.sort();
  let streak = 0;
  let prev = null;
  for (const day of uniqueDays.reverse()) {
    if (!prev) {
      streak = 1;
      prev = day;
      continue;
    }
    const diff = (new Date(prev) - new Date(day)) / 86400_000;
    if (diff <= 2) {
      streak++;
      prev = day;
    } else break;
  }

  const presence = profile.attendance ?? 85;
  const performance = profile.performance ?? 70;
  const flags = safeArr(profile.flags);

  // Burnout signal: high late + high open + low presence
  const burnoutRisk =
    (lateArrivals.length > 3 ? 1 : 0) +
    (overdue > 2 ? 1 : 0) +
    (presence < 75 ? 1 : 0) +
    (pendingLeaves > 0 ? 1 : 0);
  const burnoutLabel =
    burnoutRisk >= 3 ? "high" : burnoutRisk >= 2 ? "medium" : burnoutRisk >= 1 ? "low" : "none";

  const engagementScore = Math.round(
    completionRate * 0.4 + presence * 0.4 + Math.min(100, recentKudos * 20) * 0.2,
  );

  // Insight string derived from metrics
  const insights = [];
  if (punctualityPct !== null && punctualityPct < 75)
    insights.push(
      `${emp.name}'s punctuality is at ${punctualityPct}% — late ${lateArrivals.length} time(s) this period.`,
    );
  if (overdue > 0)
    insights.push(`${overdue} overdue task${overdue > 1 ? "s" : ""} assigned to ${emp.name}.`);
  if (recentKudos >= 2)
    insights.push(
      `${emp.name} received ${recentKudos} kudos this month — strong recognition signal.`,
    );
  if (burnoutLabel === "high")
    insights.push(`${emp.name} shows high burnout indicators. Consider a 1:1 check-in.`);
  if (approvedLeaves >= 3)
    insights.push(
      `${emp.name} has taken ${approvedLeaves} leaves this period — monitor attendance continuity.`,
    );
  if (completionRate >= 90 && total >= 5)
    insights.push(
      `${emp.name} maintains ${completionRate}% task completion — top productivity signal.`,
    );

  return {
    employeeId: emp.id,
    name: emp.name,
    role: emp.role,
    team: profile.team ?? emp.hubId ?? "HQ",
    zone: profile.zone ?? emp.hubId ?? "All",
    managerId: emp.managerId ?? null,
    appRole: profile.appRole ?? "employee",
    presence,
    performance,
    flags,
    tasks: { total, done, overdue, completionRate },
    leaves: { approved: approvedLeaves, pending: pendingLeaves },
    attendance: {
      clockInCount: clockIns.length,
      lateArrivals: lateArrivals.length,
      punctualityPct,
      streakDays: streak,
    },
    kudos: { total: empKudos.length, recent: recentKudos },
    burnoutRisk: burnoutLabel,
    engagementScore,
    insights,
    riskFlags: flags,
    needsIntervention: burnoutLabel === "high" || overdue > 3 || presence < 65,
  };
}

// ─── GET /api/operator/ping ───────────────────────────────────────────────────
router.get("/ping", (req, res) => {
  res.json({ ok: true });
});

// ─── GET /api/operator/team-intelligence ────────────────────────────────────
router.get(
  "/team-intelligence",
  asyncHandler(async (req, res) => {
    const { from } = dateRange(30);

    const [allEmployees, tasks, leaves, attEvents, kudos, allKpis, allTargets] = await Promise.all([
      Employee.find({}).lean(),
      Task.find({ createdAt: { $gte: new Date(from).getTime() } }).lean(),
      Leave.find({ startDate: { $gte: from } }).lean(),
      AttendanceEvent.find({ ts: { $gte: new Date(from).getTime() } }).lean(),
      Kudo.find({ ts: { $gte: new Date(from).getTime() } }).lean(),
      KpiDefinition.find({ active: true }).lean(),
      KpiTarget.find({}).lean(),
    ]);

    const visibleIds = await resolveVisibleIds(req.user, allEmployees);
    const team = allEmployees.filter((e) => visibleIds.has(e.id));

    const members = team.map((emp) => computeMemberMetrics(emp, tasks, leaves, attEvents, kudos));

    // ─── aggregate team health ───────────────────────────────────────────
    const total = members.length;
    const present = members.filter((m) => m.attendance.clockInCount > 0).length;
    const late = members.filter((m) => m.attendance.lateArrivals > 0).length;
    const leaveRisk = members.filter((m) => m.leaves.pending > 0).length;
    const burnoutHigh = members.filter((m) => m.burnoutRisk === "high").length;
    const interventionNeeded = members.filter((m) => m.needsIntervention);
    const topPerformers = [...members].sort((a, b) => b.performance - a.performance).slice(0, 3);

    const avgEngagement =
      members.length > 0
        ? Math.round(members.reduce((s, m) => s + m.engagementScore, 0) / members.length)
        : 0;
    const avgCompletion =
      members.length > 0
        ? Math.round(members.reduce((s, m) => s + m.tasks.completionRate, 0) / members.length)
        : 0;
    const avgPresence =
      members.length > 0
        ? Math.round(members.reduce((s, m) => s + m.presence, 0) / members.length)
        : 0;

    // Cross-team comparative: group by team
    const byTeam = {};
    for (const m of members) {
      const key = m.team || "HQ";
      if (!byTeam[key]) byTeam[key] = [];
      byTeam[key].push(m);
    }
    const teamComparison = Object.entries(byTeam).map(([teamName, members]) => ({
      team: teamName,
      count: members.length,
      avgPerformance: Math.round(members.reduce((s, m) => s + m.performance, 0) / members.length),
      avgPresence: Math.round(members.reduce((s, m) => s + m.presence, 0) / members.length),
      avgCompletion: Math.round(
        members.reduce((s, m) => s + m.tasks.completionRate, 0) / members.length,
      ),
      burnoutCount: members.filter((m) => m.burnoutRisk !== "none").length,
    }));

    // Org-level insights
    const orgInsights = [];
    if (burnoutHigh >= 2)
      orgInsights.push(
        `${burnoutHigh} team members show high burnout indicators — review workload distribution.`,
      );
    if (late > total * 0.3 && total > 0)
      orgInsights.push(
        `${late} of ${total} members had late arrivals this period — shift adherence needs attention.`,
      );
    if (avgCompletion < 60)
      orgInsights.push(
        `Team task completion rate is ${avgCompletion}% — below healthy threshold of 70%.`,
      );
    if (avgEngagement >= 80)
      orgInsights.push(`Strong team engagement score of ${avgEngagement}. Maintain momentum.`);
    if (leaveRisk > 0)
      orgInsights.push(
        `${leaveRisk} pending leave request${leaveRisk > 1 ? "s" : ""} awaiting review.`,
      );

    res.json({
      ok: true,
      generatedAt: Date.now(),
      period: { from, daysBack: 30 },
      health: {
        total,
        present,
        late,
        absent: total - present,
        leaveRisk,
        burnoutHigh,
        avgEngagement,
        avgCompletion,
        avgPresence,
      },
      members,
      topPerformers: topPerformers.map((m) => ({
        employeeId: m.employeeId,
        name: m.name,
        role: m.role,
        performance: m.performance,
        completionRate: m.tasks.completionRate,
        engagementScore: m.engagementScore,
      })),
      interventionNeeded: interventionNeeded.map((m) => ({
        employeeId: m.employeeId,
        name: m.name,
        burnoutRisk: m.burnoutRisk,
        needsIntervention: true,
        flags: m.flags,
        insights: m.insights,
      })),
      teamComparison,
      orgInsights,
      kpiDefinitions: allKpis || [],
      kpiTargets: allTargets || [],
    });
  }),
);

// ─── GET /api/operator/member/:id/intelligence ───────────────────────────────
router.get(
  "/member/:id/intelligence",
  asyncHandler(async (req, res) => {
    const empId = req.params.id;
    const { from } = dateRange(60);

    const [allEmployees, emp, tasks, leaves, attEvents, kudos, allKpis, allTargets] =
      await Promise.all([
        Employee.find({}).lean(),
        Employee.findOne({ id: empId }).lean(),
        Task.find({ assigneeId: empId, createdAt: { $gte: new Date(from).getTime() } }).lean(),
        Leave.find({ employeeId: empId, startDate: { $gte: from } }).lean(),
        AttendanceEvent.find({
          employeeId: empId,
          ts: { $gte: new Date(from).getTime() },
        }).lean(),
        Kudo.find({ toId: empId, ts: { $gte: new Date(from).getTime() } }).lean(),
        KpiDefinition.find({ active: true }).lean(),
        KpiTarget.find({}).lean(),
      ]);

    if (!emp) return res.status(404).json({ error: "Employee not found" });

    const visibleIds = await resolveVisibleIds(req.user, allEmployees);
    if (!visibleIds.has(empId)) {
      return res.status(403).json({ error: "Forbidden: outside your hierarchy" });
    }

    const metrics = computeMemberMetrics(emp, tasks, leaves, attEvents, kudos);

    // Weekly trend: group clock-ins by ISO week
    const byWeek = {};
    for (const ev of attEvents.filter((e) => e.kind === "clock_in")) {
      const d = new Date(ev.ts);
      const week = `W${Math.ceil(d.getDate() / 7)}-${d.getMonth() + 1}`;
      byWeek[week] = (byWeek[week] ?? 0) + 1;
    }
    const weeklyPresence = Object.entries(byWeek).map(([week, count]) => ({ week, count }));

    // Task trend by status
    const tasksByStatus = {
      todo: tasks.filter((t) => t.status === "todo").length,
      doing: tasks.filter((t) => t.status === "doing").length,
      done: tasks.filter((t) => t.status === "done").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
    };

    // Filter targets matching this member
    const memberTargets = (allTargets || []).filter((t) => {
      if (t.scopeType === "org") return true;
      if (t.scopeType === "zone" && t.scopeId === metrics.zone) return true;
      if (t.scopeType === "team" && t.scopeId === metrics.team) return true;
      if (t.scopeType === "individual" && t.scopeId === empId) return true;
      return false;
    });

    res.json({
      ok: true,
      generatedAt: Date.now(),
      period: { from, daysBack: 60 },
      metrics,
      trends: {
        weeklyPresence,
        tasksByStatus,
        kudoHistory: safeArr(kudos).map((k) => ({ ts: k.ts, tag: k.tag })),
      },
      kpiDefinitions: allKpis || [],
      kpiTargets: memberTargets || [],
    });
  }),
);

// ─── POST /api/operator/daily-brief ──────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let dailyBriefCache = {
  key: null,
  timestamp: 0,
  data: null,
};

function extractJson(content) {
  if (typeof content !== "string") return null;
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const rawJson = content.slice(start, end + 1);
    try {
      return JSON.parse(rawJson);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function validateAndCleanSummary(parsed, fallbackValues) {
  const requiredKeys = [
    "bestZone",
    "weakZone",
    "topPerformer",
    "topBlocker",
    "hotLeadRisk",
    "priorities",
    "oneLineForLeadership",
  ];
  const clean = {};
  for (const key of requiredKeys) {
    if (key === "priorities") {
      clean[key] = Array.isArray(parsed?.[key]) ? parsed[key] : (fallbackValues?.[key] || []);
    } else {
      clean[key] = typeof parsed?.[key] === "string" ? parsed[key] : (fallbackValues?.[key] || "—");
    }
  }
  return clean;
}

router.post(
  "/daily-brief",
  asyncHandler(async (req, res) => {
    const requestBody = typeof req.body === "object" && req.body !== null ? req.body : {};
    const todayStr = typeof requestBody.date === "string" ? requestBody.date : new Date().toISOString().slice(0, 10);
    const isDev = process.env.NODE_ENV !== "production";

    // 1. Caching check
    if (dailyBriefCache.key === todayStr && Date.now() - dailyBriefCache.timestamp < CACHE_TTL) {
      if (isDev) {
        console.log(`[daily-brief] Cache hit for ${todayStr}`);
      }
      return res.json(dailyBriefCache.data);
    }

    if (isDev) {
      console.log("[daily-brief] generating...");
    }

    // 2. Query MongoDB Collections Directly
    const [updates, employees, retroList, feedList] = await Promise.all([
      FlyUpdate.find({ date: todayStr }).lean(),
      Employee.find({}).lean(),
      FlyRetro.find({}).lean(),
      FlyFeed.find({}).sort({ ts: -1 }).limit(15).lean(),
    ]);

    const empMap = new Map(employees.map((e) => [e.id, e]));

    // 3. Compute Operational metrics and KPIs (Backend Rollup)
    const totals = updates.reduce(
      (acc, u) => ({
        calls: acc.calls + (u.connectedCalls || 0),
        visitsScheduled: acc.visitsScheduled + (u.visitsScheduled || 0),
        visitsCompleted: acc.visitsCompleted + (u.visitsCompleted || 0),
        hotLeads: acc.hotLeads + (u.hotLeads || 0),
        bookings: acc.bookings + (u.bookings || 0),
        blockers: acc.blockers + (typeof u.blocker === "string" && u.blocker.trim() ? 1 : 0),
      }),
      { calls: 0, visitsScheduled: 0, visitsCompleted: 0, hotLeads: 0, bookings: 0, blockers: 0 },
    );

    const byZone = new Map();
    for (const u of updates) {
      const z = u.zone || "Unzoned";
      const cur = byZone.get(z) ?? {
        zone: z,
        calls: 0,
        visitsScheduled: 0,
        visitsCompleted: 0,
        hotLeads: 0,
        bookings: 0,
        blockers: 0,
        contributors: 0,
      };
      cur.calls += (u.connectedCalls || 0);
      cur.visitsScheduled += (u.visitsScheduled || 0);
      cur.visitsCompleted += (u.visitsCompleted || 0);
      cur.hotLeads += (u.hotLeads || 0);
      cur.bookings += (u.bookings || 0);
      cur.blockers += (typeof u.blocker === "string" && u.blocker.trim()) ? 1 : 0;
      cur.contributors += 1;
      byZone.set(z, cur);
    }
    const zones = [...byZone.values()].sort(
      (a, b) => b.bookings - a.bookings || b.visitsCompleted - a.visitsCompleted,
    );

    const scored = updates.map((u) => ({
      id: u.authorId,
      score: (u.bookings || 0) * 50 + (u.hotLeads || 0) * 15 + (u.visitsCompleted || 0) * 10 + (u.connectedCalls || 0),
    }));
    scored.sort((a, b) => b.score - a.score);
    const topPerformerId = scored[0]?.id;
    const topPerformer = topPerformerId
      ? { id: topPerformerId, name: empMap.get(topPerformerId)?.name || "Someone" }
      : null;

    const submissions = updates.length;
    const teamSize = employees.filter((e) => e.profile?.appRole !== "admin" && e.role !== "admin").length;

    const blockers = updates
      .filter((u) => typeof u.blocker === "string" && u.blocker.trim())
      .map((u) => ({
        author: empMap.get(u.authorId)?.name || "Someone",
        zone: u.zone || "All",
        text: u.blocker,
      }));

    const retro = retroList.map((r) => ({
      kind: r.kind,
      body: r.body || "",
      upvotes: Array.isArray(r.upvotes) ? r.upvotes.length : 0,
    }));

    const feed = feedList.map((f) => ({
      kind: f.kind,
      author: empMap.get(f.authorId)?.name || "Someone",
      body: f.body || "",
    }));

    const rollupData = {
      totals,
      zones,
      topPerformer,
      submissions,
      teamSize: teamSize > 0 ? teamSize : 15,
      blockers,
      retro,
      feed,
    };

    // 4. Construct AI System & User Prompt Context
    const systemPrompt = `You are the operations chief-of-staff for Gharpayy Fly, a PG (paying-guest housing) field-ops team. You produce a one-page daily summary for leadership: terse, specific, action-oriented, no fluff, no emojis. Always return strict JSON matching the requested schema.`;
    const userPrompt = `Today's roll-up:
${JSON.stringify(rollupData, null, 2)}

Produce JSON with EXACTLY these fields:
{
  "bestZone": "<zone name + one-line why>",
  "weakZone": "<zone name + one-line why>",
  "topPerformer": "<person name + one-line why>",
  "topBlocker": "<the single most repeated/severe blocker>",
  "hotLeadRisk": "<one-line risk on hot-lead inactivity or pending tokens>",
  "priorities": ["<priority 1 for tomorrow>", "<priority 2>", "<priority 3>"],
  "oneLineForLeadership": "<a single sentence summarising the day>"
}
Return ONLY the JSON, no prose.`;

    const fallbackSummary = {
      bestZone: zones[0]?.zone
        ? `${zones[0].zone} remains strongest with steady bookings and momentum.`
        : "Top zone data unavailable.",
      weakZone: zones[zones.length - 1]?.zone
        ? `${zones[zones.length - 1].zone} needs focus on bookings and follow-ups.`
        : "No weak zone identified.",
      topPerformer: topPerformer?.name
        ? `${topPerformer.name} for closing the most bookings today.`
        : "Top performer data unavailable.",
      topBlocker: blockers[0]?.text || "No major blocker reported.",
      hotLeadRisk: `Monitor hot leads from top zones to avoid losing momentum.`,
      priorities: [
        `Follow up on leads in ${zones[0]?.zone || "the leading zone"}.`,
        `Resolve the top blocker: ${blockers[0]?.text || "none reported"}.`,
        `Maintain bookings momentum across all zones.`,
      ],
      oneLineForLeadership: `Execution stable with ${totals.bookings || 0} bookings across ${zones.length || 0} zones today.`,
    };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      if (isDev) {
        console.warn("[daily-brief] failure: LOVABLE_API_KEY is missing on server");
      }
      const result = { summary: null, error: "AI service unreachable" };
      return res.status(503).json(result);
    }

    if (isDev) {
      console.log("[daily-brief] ai provider: google/gemini-2.5-flash");
      console.log("[daily-brief] ai request URL: https://ai.gateway.lovable.dev/v1/chat/completions");
    }

    // 6. Call AI Provider with AbortController Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (isDev) {
        console.warn("[daily-brief] AI request timed out");
      }
      controller.abort();
    }, 12000); // 12-second timeout

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        if (isDev) {
          console.error(`[daily-brief] failure: AI gateway returned ${response.status}: ${text}`);
        }
        const result = { summary: null, error: "AI service unreachable" };
        return res.status(503).json(result);
      }

      const json = await response.json();
      const rawContent = json.choices?.[0]?.message?.content ?? "{}";

      // 7. Sanitize response and parse JSON safely
      const parsedJson = extractJson(rawContent);
      const cleanSummary = validateAndCleanSummary(parsedJson, fallbackSummary);

      if (isDev) {
        console.log("[daily-brief] success");
      }

      const result = { summary: cleanSummary, raw: rawContent };
      // Cache the successful summary
      dailyBriefCache = { key: todayStr, timestamp: Date.now(), data: result };
      return res.json(result);
    } catch (err) {
      clearTimeout(timeoutId);
      if (isDev) {
        console.error("[daily-brief] failure: fetch failed or was aborted:", err?.message || err);
      }
      const result = { summary: null, error: "AI service unreachable" };
      return res.status(503).json(result);
    }
  })
);

export default router;
