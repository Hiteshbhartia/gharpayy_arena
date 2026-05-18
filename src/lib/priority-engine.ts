// Role-aware Mission Brief.
// Replaces "Today's Mission" placeholders with a ranked list of real,
// actionable items derived from live stores. Every item has a deeplink.

import type { Employee } from "@/types/hr";
import { getRoster } from "@/lib/roster";
import { tierOf, type Tier } from "./permissions";
import { tasksFor, tasksAssignedBy } from "./task-store";
import { recentEvents } from "./event-bus";

export type MissionItem = {
  id: string;
  weight: number;           // higher = more urgent
  kicker: string;           // small label, e.g. "SLA · 12m left"
  title: string;
  body?: string;
  to: string;
  tone: "urgent" | "warn" | "info" | "neutral";
};

const H = 3600_000;

export function missionFor(actor: Employee): MissionItem[] {
  const tier = tierOf(actor);
  const items: MissionItem[] = [];
  const now = Date.now();

  // --- Personal: tasks due / overdue / urgent ---
  const my = tasksFor(actor.id).filter((t) => t.status !== "done");
  for (const t of my) {
    const overdue = t.dueAt < now;
    const dueSoon = t.dueAt - now < 2 * H;
    if (overdue) {
      items.push({
        id: `task-od-${t.id}`,
        weight: 100 + (t.priority === "urgent" ? 20 : 0),
        kicker: `Overdue · ${Math.round((now - t.dueAt) / 60000)}m`,
        title: t.title,
        body: t.relatedTo,
        to: "/tasks",
        tone: "urgent",
      });
    } else if (dueSoon || t.priority === "urgent") {
      items.push({
        id: `task-soon-${t.id}`,
        weight: 70 + (t.priority === "urgent" ? 15 : 0),
        kicker: t.priority === "urgent" ? "Urgent" : `Due in ${Math.round((t.dueAt - now) / 60000)}m`,
        title: t.title,
        body: t.relatedTo,
        to: "/tasks",
        tone: t.priority === "urgent" ? "urgent" : "warn",
      });
    }
  }

  // --- Tier-specific event feeds ---
  const events = recentEvents(80);

  if (tier === "leadership") {
    // Show org-wide escalations + open ops items
    for (const e of events.filter((x) => x.kind === "ops.escalated").slice(0, 4)) {
      items.push({
        id: `ev-${e.id}`,
        weight: 90,
        kicker: "Escalated",
        title: e.title,
        body: e.body,
        to: e.deeplink ?? "/war-room",
        tone: "urgent",
      });
    }
    const assigned = tasksAssignedBy(actor.id).filter((t) => t.status !== "done").slice(0, 3);
    for (const t of assigned) {
      items.push({
        id: `as-${t.id}`,
        weight: 40,
        kicker: "You assigned · in flight",
        title: t.title,
        body: `Owner: ${getRoster().find((e) => e.id === t.assigneeId)?.name ?? "—"}`,
        to: "/tasks",
        tone: "info",
      });
    }
  }

  if (tier === "zone_leader" || tier === "leader") {
    // Blockers from this zone
    for (const e of events.filter(
      (x) => x.kind === "blocker.raised" && (!actor.zone || x.zone === actor.zone || actor.zone === "All"),
    ).slice(0, 4)) {
      items.push({
        id: `blk-${e.id}`,
        weight: 85,
        kicker: `Blocker · ${e.zone ?? "—"}`,
        title: e.title,
        body: e.body,
        to: "/fly",
        tone: "warn",
      });
    }
    for (const e of events.filter((x) => x.kind === "partner.ticket.opened").slice(0, 3)) {
      items.push({
        id: `pt-${e.id}`,
        weight: 75,
        kicker: `Partner · ${e.severity ?? "med"}`,
        title: e.title,
        body: e.body,
        to: "/tickets",
        tone: e.severity === "urgent" ? "urgent" : "warn",
      });
    }
  }

  if (tier === "hr") {
    for (const e of events.filter((x) => x.kind === "leave.requested").slice(0, 5)) {
      items.push({
        id: `lv-${e.id}`,
        weight: 70, kicker: "Leave · pending",
        title: e.title, body: e.body,
        to: "/leaves", tone: "warn",
      });
    }
    for (const e of events.filter((x) => x.kind === "attendance.late").slice(0, 3)) {
      items.push({
        id: `at-${e.id}`,
        weight: 50, kicker: "Attendance",
        title: e.title, body: e.body,
        to: "/attendance", tone: "info",
      });
    }
  }

  if (tier === "recruiter") {
    items.push({
      id: "rec-board",
      weight: 60, kicker: "Funnel",
      title: "Review today's pipeline",
      body: "Source → screen → seal — move every card one stage.",
      to: "/recruiting", tone: "info",
    });
  }

  if (tier === "partner") {
    for (const e of events.filter(
      (x) => x.kind === "partner.ticket.opened" && x.actorId === actor.id,
    ).slice(0, 3)) {
      items.push({
        id: `mt-${e.id}`,
        weight: 60, kicker: "Your request · in queue",
        title: e.title, body: e.body,
        to: "/partner", tone: "info",
      });
    }
  }

  // Sort by weight desc, cap to 5
  items.sort((a, b) => b.weight - a.weight);
  return items.slice(0, 5);
}

export const TIER_MISSION_LABEL: Record<Tier, string> = {
  leadership: "Command brief",
  zone_leader: "Zone brief",
  hr: "People brief",
  leader: "Pod brief",
  recruiter: "Funnel brief",
  teammate: "Today's brief",
  partner: "Property brief",
};
