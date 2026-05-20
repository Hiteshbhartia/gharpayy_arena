import { createFileRoute } from "@tanstack/react-router";
import { useAttendanceState } from "@/hooks/useAttendance";
import {
  fmtDuration,
  fmtTime,
  getEventsFor,
  liveStatusFor,
  todayKey,
  todaySummary,
} from "@/lib/attendance-store";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Camera, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { useRosterState } from "@/hooks/useRoster";
import { Loader2 } from "lucide-react";
import type { AttEvent } from "@/lib/attendance-store";
import type { Employee } from "@/types/hr";

export const Route = createFileRoute("/roster")({
  head: () => ({
    meta: [
      { title: "Live Roster — Gharpayy Core" },
      {
        name: "description",
        content:
          "Admin live roster: who is clocked in, on break, in the field, or absent — with selfies and last known location.",
      },
    ],
  }),
  component: () => (
    <RoleGate allow={["leadership", "hr", "leader"]}>
      <RosterPage />
    </RoleGate>
  ),
});

function RosterPage() {
  useAttendanceState();
  const { roster, loading } = useRosterState();
  const today = todayKey();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const rows = roster.map((e) => {
    const events = getEventsFor(e.id, today);
    const summary = todaySummary(e.id);
    const status = liveStatusFor(e.id);
    const lastEv = [...events].sort((a, b) => b.ts - a.ts)[0] || null;
    return { emp: e, events, summary, status, lastEv };
  });

  const counts = {
    "Clocked In": rows.filter((r) => r.status === "Clocked In").length,
    "On Break": rows.filter((r) => r.status === "On Break").length,
    "In Field": rows.filter((r) => r.status === "In Field").length,
    Off: rows.filter((r) => r.status === "Off").length,
  };

  return (
    <div className="p-8 space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
          Live Roster · Admin View
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">
          Who's where, right now
        </h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Clocked In" value={counts["Clocked In"]} tone="success" />
        <Tile label="On Break" value={counts["On Break"]} tone="warning" />
        <Tile label="In Field" value={counts["In Field"]} tone="primary" />
        <Tile label="Off" value={counts["Off"]} tone="muted" />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map((row) => (
          <RosterCard key={row.emp.id} {...row} />
        ))}
      </div>
    </div>
  );
}

function formatEventKind(kind: string) {
  return kind
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function RosterCard({
  emp,
  summary,
  status,
  events,
}: {
  emp: Employee;
  summary: any;
  status: string;
  events: AttEvent[];
  lastEv: AttEvent | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const sortedEvents = [...events].sort((a: AttEvent, b: AttEvent) => b.ts - a.ts);

  return (
    <Card className="p-4 flex flex-col h-full">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 shrink-0 border border-border">
          <AvatarFallback className="bg-muted text-foreground font-medium">
            {emp.name
              .split(" ")
              .map((s: string) => s[0])
              .slice(0, 2)
              .join("")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{emp.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {emp.team} · {emp.role} · {emp.appRole}
              </div>
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1 text-[11px] font-mono uppercase tracking-widest">
            <Mini label="Work" value={fmtDuration(summary.workMs)} />
            <Mini label="Break" value={fmtDuration(summary.breakMs)} />
            <Mini label="Field" value={fmtDuration(summary.fieldMs)} />
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex flex-col flex-1">
        {sortedEvents.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                {events.length} event{events.length === 1 ? "" : "s"} today
              </div>
              {events.length > 1 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors flex items-center gap-1 font-medium uppercase tracking-widest font-mono"
                >
                  {expanded ? "Collapse" : "Timeline"}
                  {expanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>

            <div className="space-y-4">
              {sortedEvents.slice(0, expanded ? undefined : 1).map((ev: AttEvent, i: number) => (
                <div key={ev.id} className={`flex gap-3 ${i === 0 ? "" : "opacity-75"}`}>
                  {ev.selfie ? (
                    <a href={ev.selfie} target="_blank" rel="noreferrer" className="shrink-0">
                      <img
                        src={ev.selfie}
                        alt="selfie"
                        className="h-10 w-10 md:h-12 md:w-12 rounded-md object-cover border border-border shadow-sm bg-muted"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <div className="h-10 w-10 md:h-12 md:w-12 shrink-0 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground bg-muted/30">
                      <Camera className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] md:text-[11px] font-medium uppercase tracking-widest font-mono ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {formatEventKind(ev.kind)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {fmtTime(ev.ts)}
                      </span>
                    </div>
                    {ev.address && (
                      <div className="text-[11px] md:text-xs text-muted-foreground flex items-start gap-1.5 mt-1 leading-snug">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/70" />
                        <span className="truncate" title={ev.address}>
                          {ev.address}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-warning flex-1 py-1">
            <AlertTriangle className="h-3.5 w-3.5" /> No punch yet today
          </div>
        )}
      </div>
    </Card>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "primary" | "muted";
}) {
  const cls =
    tone === "success"
      ? "border-success/30 bg-success/5 text-success"
      : tone === "warning"
        ? "border-warning/30 bg-warning/5 text-warning"
        : tone === "primary"
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-border bg-muted/30 text-muted-foreground";
  return (
    <Card className={`p-4 border ${cls}`}>
      <div className="text-[10px] uppercase tracking-widest font-mono">{label}</div>
      <div className="font-display text-3xl font-semibold tabular-nums mt-1">{value}</div>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-muted/40 border border-border px-2 py-1 text-center">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="text-xs text-foreground font-mono tabular-nums">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Clocked In"
      ? "bg-success/15 text-success border-success/30"
      : status === "On Break"
        ? "bg-warning/15 text-warning border-warning/30"
        : status === "In Field"
          ? "bg-primary/15 text-primary border-primary/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <Badge
      variant="outline"
      className={`${tone} border font-mono text-[9px] uppercase tracking-widest shrink-0`}
    >
      {status}
    </Badge>
  );
}
