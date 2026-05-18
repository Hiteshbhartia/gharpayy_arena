import { createFileRoute } from "@tanstack/react-router";
import { useCalendarEvents, eventColor } from "@/lib/calendar-store";
import { getRoster } from "@/lib/roster";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

function dayBucket(ts: number): string {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 0 && diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
}

function CalendarPage() {
  const events = useCalendarEvents();
  const groups = new Map<string, typeof events>();
  events.forEach((e) => {
    const key = dayBucket(e.startAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  });

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1100px] mx-auto">
      <header className="mb-5">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">Schedule</div>
        <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground text-sm mt-1">Shifts, tours, tasks, leaves — one timeline.</p>
      </header>
      <div className="space-y-5">
        {Array.from(groups.entries()).map(([day, items]) => (
          <section key={day}>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">{day}</div>
            <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
              {items.map((e) => {
                const owner = e.ownerId ? getRoster().find((x) => x.id === e.ownerId) : null;
                return (
                  <div key={e.id} className="px-4 md:px-5 py-3 flex items-center gap-3">
                    <div className="text-right shrink-0 w-16">
                      <div className="text-sm font-semibold">{new Date(e.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{new Date(e.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`inline-block text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border mb-1 ${eventColor(e.type)}`}>{e.type}</div>
                      <div className="font-medium text-sm truncate">{e.title}</div>
                      {e.location && <div className="text-[11px] text-muted-foreground truncate">{e.location}</div>}
                    </div>
                    {owner && <Avatar id={owner.id} size={28} />}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
