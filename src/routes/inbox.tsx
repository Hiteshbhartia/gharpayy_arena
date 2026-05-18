import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useNotifications, markRead, markAllRead, kindBadge } from "@/lib/notification-store";
import { useAttendanceState } from "@/hooks/useAttendance";
import { Avatar } from "@/components/Avatar";
import { Bell, Check } from "lucide-react";

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

function timeAgo(ts: number) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function InboxPage() {
  const { actor } = useAttendanceState();
  const list = useNotifications(actor.id);
  const navigate = useNavigate();
  const unread = list.filter((n) => !n.read).length;

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[900px] mx-auto">
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
            Notifications
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {unread} unread · everything in one place.
          </p>
        </div>
        <button
          onClick={() => markAllRead(actor.id)}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Check className="h-3 w-3" /> Mark all read
        </button>
      </header>
      <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
        {list.length === 0 && (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">
            <Bell className="h-5 w-5 mx-auto mb-2 opacity-40" /> All clear.
          </div>
        )}
        {list.map((n) => {
          const badge = kindBadge(n.kind);
          return (
            <div
              key={n.id}
              className={`px-4 md:px-5 py-3 transition-colors flex gap-3 ${!n.read ? "bg-primary/5" : ""}`}
            >
              {n.fromId ? (
                <Avatar id={n.fromId} size={36} />
              ) : (
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(n.ts)}</span>
                  {!n.read && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                </div>
                <div className="font-medium text-sm mt-1">{n.title}</div>
                <div className="text-xs text-muted-foreground">{n.body}</div>
                <div className="mt-2 flex items-center gap-2">
                  {n.actionTo && (
                    <button
                      onClick={() => {
                        markRead(n.id);
                        navigate({ to: n.actionTo! });
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {n.actionLabel ?? "Open"}
                    </button>
                  )}
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1"
                    >
                      <Check className="h-3 w-3" /> Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
