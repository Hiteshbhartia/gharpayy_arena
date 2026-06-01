import { createFileRoute, Link } from "@tanstack/react-router";
import type { Tier } from "@/types/hr";
import { teamSummary, tierFor } from "@/lib/team-metrics";
import { useRosterState } from "@/hooks/useRoster";
import { Loader2 } from "lucide-react";
import { ArrowDown, ArrowUp, Flame, Target, IndianRupee, Phone, AlertTriangle } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";

export const Route = createFileRoute("/war-room")({
  component: () => (
    <RoleGate allow={["leadership", "zone_leader", "leader"]}>
      <WarRoom />
    </RoleGate>
  ),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

const tierColor: Record<Tier, string> = {
  A: "bg-success/10 text-success border-success/20",
  B: "bg-info/10 text-info border-info/20",
  C: "bg-warning/15 text-warning border-warning/30",
  D: "bg-destructive/10 text-destructive border-destructive/20",
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 md:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${accent ?? "text-muted-foreground"}`} />
      </div>
      <div className="mt-2 font-display text-2xl md:text-3xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ScoreBar({ value, color = "bg-primary" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function WarRoom() {
  const { roster, loading } = useRosterState();
  const s = teamSummary(roster);
  const sorted = [...roster].sort((a, b) => b.performance - a.performance);
  const inr = (n: number) =>
    "₹" + (n >= 100000 ? (n / 100000).toFixed(1) + "L" : n.toLocaleString("en-IN"));

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
      <header className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1.5">
          Daily War Room
        </div>
        <h1 className="font-display text-2xl md:text-4xl font-semibold tracking-tight">
          Today's execution snapshot
        </h1>
        <p className="text-muted-foreground text-sm mt-1">No hiding. No confusion.</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard
          label="Revenue"
          value={inr(s.totalRevenue)}
          sub={`${s.totalDeals} deals`}
          icon={IndianRupee}
          accent="text-primary"
        />
        <StatCard label="Calls" value={String(s.totalCalls)} icon={Phone} accent="text-info" />
        <StatCard
          label="Active leads"
          value={String(s.totalLeads)}
          icon={Target}
          accent="text-warning"
        />
        <StatCard
          label="A-players"
          value={String(s.counts.A)}
          sub={`B:${s.counts.B} C:${s.counts.C} D:${s.counts.D}`}
          icon={Flame}
          accent="text-success"
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6">
        <div className="rounded-xl bg-card border border-border p-4 md:p-5">
          <div className="flex items-center gap-2 text-success mb-2">
            <ArrowUp className="h-4 w-4" />
            <span className="text-[10px] font-mono uppercase tracking-widest">Top Performer</span>
          </div>
          <div className="font-display text-lg font-semibold">{s.top?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground mb-3">{s.top?.role ?? ""}</div>
          {s.top && <ScoreBar value={s.top.performance} color="bg-success" />}
        </div>
        <div className="rounded-xl bg-card border border-border p-4 md:p-5">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <ArrowDown className="h-4 w-4" />
            <span className="text-[10px] font-mono uppercase tracking-widest">Replace Signal</span>
          </div>
          <div className="font-display text-lg font-semibold">{s.bottom?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground mb-3">
            {s.bottom ? `${s.bottom.role} · ${(s.bottom.flags ?? []).length} flags` : ""}
          </div>
          {s.bottom && <ScoreBar value={s.bottom.performance} color="bg-destructive" />}
        </div>
      </section>

      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-4 md:px-5 py-3 md:py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-base md:text-lg font-semibold">Live Leaderboard</h2>
          <Link to="/score" className="text-xs text-primary hover:underline">
            My score →
          </Link>
        </div>
        <div className="divide-y divide-border">
          {sorted.map((e, i) => {
            const t = tierFor(e.performance);
            return (
              <div key={e.id} className="px-4 md:px-5 py-3 flex items-center gap-3">
                <div className="w-6 font-mono text-xs text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{e.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {e.role} · {e.team}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center justify-center h-6 w-6 rounded border font-mono font-semibold text-[11px] ${tierColor[t]}`}
                >
                  {t}
                </span>
                <div className="w-12 text-right font-mono text-sm font-semibold">
                  {e.performance}
                </div>
                {(e.flags ?? []).length > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    {(e.flags ?? []).length}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
