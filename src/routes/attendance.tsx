import { createFileRoute } from "@tanstack/react-router";
import { useAttendanceState } from "@/hooks/useAttendance";
import { AttendancePanel } from "@/components/AttendancePanel";
import { EventTimeline } from "@/components/EventTimeline";
import { Card } from "@/components/ui/card";
import { getEventsFor, todayKey, todaySummary, fmtDuration } from "@/lib/attendance-store";
import { MapPin, ShieldCheck, Camera, Clock } from "lucide-react";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — Gharpayy Core" },
      {
        name: "description",
        content:
          "Selfie-driven, geo-tagged attendance: clock-in, clock-out, breaks and field visits with full audit trail.",
      },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { actor } = useAttendanceState();
  const today = getEventsFor(actor.id, todayKey());
  const summary = todaySummary(actor.id);

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
            Attendance · Demo Mode
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">
            Selfie + Geo Punch
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Every clock event captures a live front-camera selfie and high-accuracy GPS, then
            resolves the address. Switch the "Acting as" user in the sidebar to punch in for any
            teammate.
          </p>
        </div>
        <div className="flex gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          <Pill icon={Camera}>Selfie required</Pill>
          <Pill icon={MapPin}>GPS captured</Pill>
          <Pill icon={ShieldCheck}>Audit logged</Pill>
        </div>
      </header>

      <div className="grid lg:grid-cols-[420px_1fr] gap-6">
        <div className="space-y-4">
          <AttendancePanel />

          <Card className="p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-mono text-muted-foreground mb-3">
              <Clock className="h-3.5 w-3.5" /> Today at a glance
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Events</dt>
              <dd className="text-right tabular-nums font-medium">{today.length}</dd>
              <dt className="text-muted-foreground">Work</dt>
              <dd className="text-right tabular-nums font-medium">{fmtDuration(summary.workMs)}</dd>
              <dt className="text-muted-foreground">Break</dt>
              <dd className="text-right tabular-nums font-medium">
                {fmtDuration(summary.breakMs)}
              </dd>
              <dt className="text-muted-foreground">Field</dt>
              <dd className="text-right tabular-nums font-medium">
                {fmtDuration(summary.fieldMs)}
              </dd>
            </dl>
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
                Today's timeline
              </div>
              <h2 className="font-display font-semibold text-lg mt-0.5">{actor.name}</h2>
            </div>
          </div>
          <EventTimeline events={today} />
        </Card>
      </div>
    </div>
  );
}

function Pill({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-card">
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}
