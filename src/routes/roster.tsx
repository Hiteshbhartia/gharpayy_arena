import { createFileRoute } from "@tanstack/react-router";
import { useAttendanceState } from "@/hooks/useAttendance";
import {
  fmtDuration,
  fmtTime,
  getEventsFor,
  liveStatusFor,
  todayKey,
  todaySummary,
  fetchAttendanceByDate,
  statusFromEvents,
  summaryFromEvents,
  type AttEvent,
  type RosterEvent,
} from "@/lib/attendance-store";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MapPin,
  Camera,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { useRosterState } from "@/hooks/useRoster";
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
    <RoleGate allow={["leadership", "zone_leader", "hr", "leader"]}>
      <RosterPage />
    </RoleGate>
  ),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Unified row shape used by both today (from store) and historical (from API). */
type RosterRow = {
  empId: string;
  empName: string;
  empRole: string;
  empTeam: string;
  empAppRole?: string;
  /** Employee record — present for today view, may be absent for historical */
  emp?: Employee;
  events: (AttEvent | RosterEvent)[];
  status: string;
  workMs: number;
  breakMs: number;
  fieldMs: number;
  firstClockIn: number | null;
  lastClockOut: number | null;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function RosterPage() {
  useAttendanceState();
  const { roster, loading: rosterLoading } = useRosterState();
  const today = todayKey();

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const isToday = selectedDate === today;

  // Historical fetch state
  const [histEvents, setHistEvents] = useState<RosterEvent[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);

  useEffect(() => {
    if (isToday) {
      setHistEvents([]);
      setHistError(null);
      return;
    }
    let cancelled = false;
    setHistLoading(true);
    setHistError(null);
    fetchAttendanceByDate(selectedDate)
      .then((items) => {
        if (!cancelled) setHistEvents(items);
      })
      .catch((err) => {
        if (!cancelled)
          setHistError(err instanceof Error ? err.message : "Failed to load attendance");
      })
      .finally(() => {
        if (!cancelled) setHistLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, isToday]);

  const loading = rosterLoading || histLoading;

  // ---------------------------------------------------------------------------
  // Build rows
  // ---------------------------------------------------------------------------

  let rows: RosterRow[] = [];

  if (isToday) {
    // Today: use the in-memory store exactly as before
    rows = roster.map((e) => {
      const events = getEventsFor(e.id, today);
      const summary = todaySummary(e.id);
      const status = liveStatusFor(e.id);
      return {
        empId: e.id,
        empName: e.name,
        empRole: e.role,
        empTeam: e.team,
        empAppRole: e.appRole,
        emp: e,
        events,
        status,
        workMs: summary.workMs,
        breakMs: summary.breakMs,
        fieldMs: summary.fieldMs,
        firstClockIn: summary.firstClockIn,
        lastClockOut: summary.lastClockOut,
      };
    });
  } else {
    // Historical: group events by employeeId
    const byEmp = new Map<string, RosterEvent[]>();
    for (const ev of histEvents) {
      const arr = byEmp.get(ev.employeeId) ?? [];
      arr.push(ev);
      byEmp.set(ev.employeeId, arr);
    }

    // Also include roster employees who have no events (show as absent)
    const seenIds = new Set(byEmp.keys());
    for (const e of roster) {
      if (!seenIds.has(e.id)) {
        byEmp.set(e.id, []);
      }
    }

    for (const [empId, events] of byEmp.entries()) {
      // Prefer name/role from the live roster; fall back to what the API returned
      const rosterEmp = roster.find((e) => e.id === empId);
      const firstEv = events[0];
      const summary = summaryFromEvents(events);
      const status = statusFromEvents(events);
      rows.push({
        empId,
        empName: rosterEmp?.name ?? firstEv?.employeeName ?? empId,
        empRole: rosterEmp?.role ?? firstEv?.employeeRole ?? "—",
        empTeam: rosterEmp?.team ?? firstEv?.employeeTeam ?? "HQ",
        empAppRole: rosterEmp?.appRole,
        emp: rosterEmp,
        events,
        status,
        ...summary,
      });
    }

    // Sort: employees with events first, then alphabetically
    rows.sort((a, b) => {
      const aHas = a.events.length > 0 ? 0 : 1;
      const bHas = b.events.length > 0 ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return a.empName.localeCompare(b.empName);
    });
  }

  const counts = {
    "Clocked In": rows.filter((r) => r.status === "Clocked In").length,
    "On Break": rows.filter((r) => r.status === "On Break").length,
    "In Field": rows.filter((r) => r.status === "In Field").length,
    Off: rows.filter((r) => r.status === "Off").length,
  };

  return (
    <div className="p-8 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
            {isToday ? "Live Roster · Admin View" : `Attendance History · ${selectedDate}`}
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">
            {isToday ? "Who's where, right now" : "Historical Attendance"}
          </h1>
        </div>

        {/* Date picker */}
        <div className="flex items-center gap-2 shrink-0">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => setSelectedDate(e.target.value || today)}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            aria-label="Select attendance date"
          />
          {!isToday && (
            <button
              onClick={() => setSelectedDate(today)}
              className="h-9 px-3 rounded-md border border-border bg-secondary text-xs font-mono uppercase tracking-widest hover:bg-secondary/70 transition-colors"
            >
              Today
            </button>
          )}
        </div>
      </header>

      {/* Error banner */}
      {histError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {histError}
        </div>
      )}

      {/* Loading spinner */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="Clocked In" value={counts["Clocked In"]} tone="success" />
            <Tile label="On Break" value={counts["On Break"]} tone="warning" />
            <Tile label="In Field" value={counts["In Field"]} tone="primary" />
            <Tile label="Off / Absent" value={counts["Off"]} tone="muted" />
          </div>

          {rows.length === 0 && !isToday && (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
              No attendance records found for {selectedDate}.
            </div>
          )}

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {rows.map((row) => (
              <RosterCard key={row.empId} row={row} isToday={isToday} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RosterCard — reuses the exact same selfie + location UI as before.
// Now accepts the unified RosterRow instead of separate props.
// ---------------------------------------------------------------------------

function formatEventKind(kind: string) {
  return kind
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function RosterCard({ row, isToday }: { row: RosterRow; isToday: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const sortedEvents = [...row.events].sort(
    (a: AttEvent | RosterEvent, b: AttEvent | RosterEvent) => b.ts - a.ts,
  );

  const subtitleParts = [row.empTeam, row.empRole, row.empAppRole].filter(Boolean);

  return (
    <Card className="p-4 flex flex-col h-full">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 shrink-0 border border-border">
          <AvatarFallback className="bg-muted text-foreground font-medium">
            {row.empName
              .split(" ")
              .map((s: string) => s[0])
              .slice(0, 2)
              .join("")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{row.empName}</div>
              <div className="text-xs text-muted-foreground truncate">
                {subtitleParts.join(" · ")}
              </div>
            </div>
            <StatusBadge status={row.status} />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1 text-[11px] font-mono uppercase tracking-widest">
            <Mini label="Work" value={fmtDuration(row.workMs)} />
            <Mini label="Break" value={fmtDuration(row.breakMs)} />
            <Mini label="Field" value={fmtDuration(row.fieldMs)} />
          </div>

          {/* Clock-in / clock-out times for historical view */}
          {!isToday && (row.firstClockIn || row.lastClockOut) && (
            <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
              {row.firstClockIn && (
                <span>
                  In: <span className="text-foreground">{fmtTime(row.firstClockIn)}</span>
                </span>
              )}
              {row.lastClockOut && (
                <span>
                  Out: <span className="text-foreground">{fmtTime(row.lastClockOut)}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex flex-col flex-1">
        {sortedEvents.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                {row.events.length} event{row.events.length === 1 ? "" : "s"}{" "}
                {isToday ? "today" : "that day"}
              </div>
              {row.events.length > 1 && (
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

            {/* Event list — identical selfie + location rendering as before */}
            <div className="space-y-4">
              {sortedEvents
                .slice(0, expanded ? undefined : 1)
                .map((ev: AttEvent | RosterEvent, i: number) => (
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
                          className={`text-[10px] md:text-[11px] font-medium uppercase tracking-widest font-mono ${
                            i === 0 ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {formatEventKind(ev.kind)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {fmtTime(ev.ts)}
                        </span>
                      </div>
                      <LocationLink
                        address={ev.address}
                        lat={ev.lat}
                        lng={ev.lng}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-warning flex-1 py-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {isToday ? "No punch yet today" : "No attendance recorded"}
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Small shared components (unchanged from original)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// LocationLink — renders 📍 address + "Open in Maps" link when lat/lng exist.
// Used for both today and historical events. No API key, no map embed.
// ---------------------------------------------------------------------------

function LocationLink({
  address,
  lat,
  lng,
}: {
  address: string | null | undefined;
  lat: number | null | undefined;
  lng: number | null | undefined;
}) {
  const hasCoords = lat != null && lng != null;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null;

  // Nothing to show if there's no address and no coords
  if (!address && !hasCoords) return null;

  const displayText = address ?? `${lat!.toFixed(5)}, ${lng!.toFixed(5)}`;

  return (
    <div className="mt-1 space-y-0.5">
      {/* 📍 Address line */}
      <div className="text-[11px] md:text-xs text-muted-foreground flex items-start gap-1.5 leading-snug">
        <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/70" />
        <span className="truncate" title={displayText}>
          {displayText}
        </span>
      </div>

      {/* "Open in Maps" link — only when coords are available */}
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:text-primary/80 hover:underline transition-colors ml-4"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          Open in Maps
        </a>
      )}
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
