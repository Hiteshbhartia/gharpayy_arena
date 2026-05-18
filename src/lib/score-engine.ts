import type { Employee } from "@/types/hr";
import { tierFor } from "@/lib/team-metrics";
import { getRoster } from "@/lib/roster";
import { tasksFor } from "./task-store";
import { kudosReceived } from "./kudos-store";

export interface ScoreBreakdown {
  attendance: number; // 0-100
  taskOnTime: number; // 0-100
  kudos: number; // 0-100 (capped count)
  roleKpi: number; // 0-100
  total: number; // weighted
}

const D = 24 * 60 * 60 * 1000;

export function computeScore(emp: Employee): ScoreBreakdown {
  const att = emp.attendance;
  const tasks = tasksFor(emp.id);
  const completed = tasks.filter((t) => t.status === "done");
  const onTime = completed.filter((t) => (t.completedAt ?? 0) <= t.dueAt).length;
  const taskOnTime = completed.length > 0 ? Math.round((onTime / completed.length) * 100) : emp.taskCompletion;

  const recent = kudosReceived(emp.id, Date.now() - 30 * D);
  const kudos = Math.min(100, recent.length * 25);

  // Role-specific KPI proxy
  let roleKpi = emp.performance;
  if (emp.role === "Operator") roleKpi = Math.round(emp.conversion * 3 + (emp.callsToday / Math.max(1, emp.callTarget)) * 50);
  else if (emp.role === "TCM") roleKpi = Math.round(emp.taskCompletion);
  else if (emp.role === "Floor Lead") roleKpi = Math.round(emp.performance);
  roleKpi = Math.max(0, Math.min(100, roleKpi));

  const total = Math.round(att * 0.4 + taskOnTime * 0.3 + kudos * 0.15 + roleKpi * 0.15);
  return { attendance: att, taskOnTime, kudos, roleKpi, total };
}

export function squadOf(emp: Employee): Employee[] {
  // Same team OR people they manage / manager
  return getRoster().filter(
    (e) =>
      e.id !== emp.id &&
      (e.team === emp.team || e.managerId === emp.id || e.id === emp.managerId)
  );
}

export function rankInSquad(emp: Employee): { rank: number; total: number } {
  const squad = [emp, ...squadOf(emp)];
  const ranked = squad
    .map((e) => ({ id: e.id, score: computeScore(e).total }))
    .sort((a, b) => b.score - a.score);
  const idx = ranked.findIndex((r) => r.id === emp.id);
  return { rank: idx + 1, total: ranked.length };
}

export function tierOf(emp: Employee) {
  return tierFor(computeScore(emp).total);
}

export function trendData(emp: Employee, weeks = 8): number[] {
  // Deterministic synthetic trend so it looks alive but stable per-employee
  const base = computeScore(emp).total;
  const seed = emp.id.charCodeAt(emp.id.length - 1);
  const out: number[] = [];
  for (let i = 0; i < weeks; i++) {
    const swing = ((seed * (i + 3)) % 11) - 5;
    out.push(Math.max(20, Math.min(100, base - 8 + i + swing)));
  }
  return out;
}
