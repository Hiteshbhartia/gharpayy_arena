import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  ShieldOff,
  Flame,
  Plus,
  Minus,
  Check,
  Clock,
  MessageSquare,
  Copy,
  Send,
  AlertTriangle,
  Target,
  Zap,
  FileText,
  ChevronRight,
  Gavel,
  Sparkles,
  Activity,
} from "lucide-react";
import { useAttendanceState } from "@/hooks/useAttendance";
import {
  PLAYBOOKS,
  playbookFor,
  fmtMin,
  nowMin,
  type RolePlaybook,
  type PlaybookKey,
} from "@/data/playbooks";
import {
  useConsoleDay,
  bumpKpi,
  setKpi,
  toggleSprint,
  markWindowSent,
  setEod,
  logDecision,
  shieldNow,
  currentSprint,
  nextSprint,
  dayHealth,
  exportEodText,
} from "@/lib/console-store";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/console")({
  component: ConsolePage,
  head: () => ({
    meta: [
      { title: "Operator Console — Gharpayy Arena" },
      {
        name: "description",
        content: "Sprint-by-sprint execution console for Gharpayy operators.",
      },
    ],
  }),
});

function ConsolePage() {
  const { actor } = useAttendanceState();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);
  // tick referenced to avoid unused warnings; force re-render every 30s
  void tick;

  const pb = playbookFor(actor.id);
  if (!pb) {
    return (
      <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold">Operator Console</h1>
              <p className="text-sm text-muted-foreground">
                Pick an operator role to see their day, sprint by sprint.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {actor.name} doesn&apos;t have an operator playbook for this account. Contact an admin
            if you need console access.
          </p>
        </div>
      </div>
    );
  }

  return <ConsoleFor pb={pb} actorId={actor.id} actorName={actor.name} />;
}

function ConsoleFor({
  pb,
  actorId,
  actorName,
}: {
  pb: RolePlaybook;
  actorId: string;
  actorName: string;
}) {
  const day = useConsoleDay(actorId);
  const shield = shieldNow(actorId);
  const sprint = currentSprint(actorId);
  const next = nextSprint(actorId);
  const health = dayHealth(actorId);

  return (
    <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-6">
      <Header pb={pb} actorName={actorName} health={health} shield={shield} />
      <NowStrip actorId={actorId} sprint={sprint} next={next} />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <KpiGrid pb={pb} actorId={actorId} day={day} />
          <SprintTimeline pb={pb} actorId={actorId} day={day} />
          <CommWindows pb={pb} actorId={actorId} day={day} />
        </div>
        <div className="space-y-6">
          <CollapseRule pb={pb} />
          <DecisionsLog actorId={actorId} day={day} />
          <EodGenerator pb={pb} actorId={actorId} day={day} />
        </div>
      </div>
    </div>
  );
}

function Header({
  pb,
  actorName,
  health,
  shield,
}: {
  pb: RolePlaybook;
  actorName: string;
  health: { score: number; label: string };
  shield: { active: boolean; label: string; until?: number };
}) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-secondary/30 p-5 md:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Flame className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">
            {pb.subtitle}
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold leading-tight">
            {pb.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-3xl">{pb.oneLiner}</p>
          <p className="text-xs italic text-muted-foreground/80 mt-2 max-w-3xl">
            — Owned today by {actorName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-center min-w-[88px]">
            <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
              Day score
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {health.score}
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <div
              className={`text-[10px] uppercase tracking-widest font-mono ${
                health.score >= 70
                  ? "text-success"
                  : health.score >= 40
                    ? "text-warning"
                    : "text-destructive"
              }`}
            >
              {health.label}
            </div>
          </div>
        </div>
      </div>

      {shield.active ? (
        <div className="mt-4 rounded-lg bg-primary/15 border border-primary/30 px-4 py-2.5 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-primary">
            Shield Mode active
          </span>
          <span className="text-sm">{shield.label}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            Until {fmtMin(shield.until ?? 0)}
          </span>
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-secondary/40 border border-border px-4 py-2.5 flex items-center gap-2 text-muted-foreground">
          <ShieldOff className="h-4 w-4" />
          <span className="font-mono text-[11px] uppercase tracking-widest">
            Shield mode off · communications open
          </span>
        </div>
      )}
    </div>
  );
}

function NowStrip({
  actorId,
  sprint,
  next,
}: {
  actorId: string;
  sprint?: ReturnType<typeof currentSprint>;
  next?: ReturnType<typeof nextSprint>;
}) {
  void actorId;
  const m = nowMin();
  if (sprint) {
    const pct = Math.round(((m - sprint.startMin) / (sprint.endMin - sprint.startMin)) * 100);
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
            Sprint {sprint.index} · live now
          </span>
          <span className="ml-auto text-xs font-mono text-muted-foreground">
            {fmtMin(sprint.startMin)} → {fmtMin(sprint.endMin)}
          </span>
        </div>
        <div className="text-base md:text-lg font-semibold">{sprint.name}</div>
        <p className="text-sm text-muted-foreground mt-1">{sprint.objective}</p>
        <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
          />
        </div>
        <div className="text-[10px] font-mono text-muted-foreground mt-1">
          {pct}% through this block
        </div>
      </div>
    );
  }
  if (next) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 md:p-5 flex items-center gap-3">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Next up
          </div>
          <div className="text-sm font-semibold">
            Sprint {next.index} · {next.name}
          </div>
        </div>
        <div className="text-xs font-mono text-primary">at {fmtMin(next.startMin)}</div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5 text-sm text-muted-foreground flex items-center gap-2">
      <Sparkles className="h-4 w-4 text-primary" /> Day complete or off-hours. Use this time for EOD
      + tomorrow prep.
    </div>
  );
}

function KpiGrid({
  pb,
  actorId,
  day,
}: {
  pb: RolePlaybook;
  actorId: string;
  day: ReturnType<typeof useConsoleDay>;
}) {
  return (
    <section>
      <SectionHead
        icon={Target}
        title="Today's KPIs"
        subtitle="Tap to log progress. Numbers turn green when you hit target."
      />
      <div className="grid sm:grid-cols-2 gap-3">
        {pb.kpis.map((k) => {
          const v = day.kpis[k.id] ?? 0;
          const hit = k.kind === "boolean" ? v >= 1 : v >= k.target;
          return (
            <div
              key={k.id}
              className={`rounded-lg border p-3 transition-colors ${
                hit ? "border-success/40 bg-success/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{k.label}</div>
                  <div className="text-[11px] text-muted-foreground italic mt-0.5 line-clamp-2">
                    {k.why}
                  </div>
                </div>
                <div
                  className={`text-xl font-bold tabular-nums shrink-0 ${hit ? "text-success" : ""}`}
                >
                  {v}
                  {k.unit && <span className="text-xs text-muted-foreground">{k.unit}</span>}
                  <span className="text-xs text-muted-foreground font-normal">
                    {" "}
                    / {k.target}
                    {k.unit ?? ""}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                {k.kind === "boolean" ? (
                  <button
                    onClick={() => setKpi(actorId, k.id, hit ? 0 : 1)}
                    className={`h-7 flex-1 inline-flex items-center justify-center gap-1 rounded text-xs font-medium border ${
                      hit
                        ? "border-success/40 bg-success/15 text-success"
                        : "border-border bg-secondary hover:bg-secondary/70"
                    }`}
                  >
                    <Check className="h-3 w-3" /> {hit ? "Done" : "Mark done"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => bumpKpi(actorId, k.id, -1)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded border border-border hover:bg-secondary"
                      aria-label="decrement"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => bumpKpi(actorId, k.id, 1)}
                      className="h-7 flex-1 inline-flex items-center justify-center gap-1 rounded border border-border hover:bg-secondary text-xs"
                    >
                      <Plus className="h-3 w-3" /> +1
                    </button>
                    <button
                      onClick={() => bumpKpi(actorId, k.id, 5)}
                      className="h-7 px-2 inline-flex items-center justify-center rounded border border-border hover:bg-secondary text-[10px] font-mono"
                    >
                      +5
                    </button>
                    <button
                      onClick={() => setKpi(actorId, k.id, k.target)}
                      className="h-7 px-2 inline-flex items-center justify-center rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-mono uppercase tracking-widest"
                    >
                      Hit
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SprintTimeline({
  pb,
  actorId,
  day,
}: {
  pb: RolePlaybook;
  actorId: string;
  day: ReturnType<typeof useConsoleDay>;
}) {
  const m = nowMin();
  return (
    <section>
      <SectionHead
        icon={Zap}
        title="Sprint plan"
        subtitle="Hour-by-hour. Tap to mark a sprint complete."
      />
      <div className="space-y-3">
        {pb.sprints.map((s) => {
          const done = !!day.sprints[s.id];
          const live = m >= s.startMin && m < s.endMin;
          const past = m >= s.endMin;
          return (
            <div
              key={s.id}
              className={`rounded-lg border p-4 transition-colors ${
                done
                  ? "border-success/40 bg-success/5"
                  : live
                    ? "border-primary/40 bg-primary/5"
                    : past
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Sprint {s.index}
                    </span>
                    <span className="font-mono text-[10px] text-primary">
                      {fmtMin(s.startMin)} → {fmtMin(s.endMin)}
                    </span>
                    {live && (
                      <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                        Live
                      </span>
                    )}
                    {past && !done && (
                      <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                        Missed?
                      </span>
                    )}
                    {s.shielded && (
                      <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 inline-flex items-center gap-1">
                        <Shield className="h-2.5 w-2.5" />
                        Shield
                      </span>
                    )}
                  </div>
                  <div className="text-base font-semibold mt-1">{s.name}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{s.objective}</div>
                </div>
                <button
                  onClick={() => toggleSprint(actorId, s.id)}
                  className={`h-8 px-3 inline-flex items-center gap-1 rounded text-xs font-medium border ${
                    done
                      ? "border-success/40 bg-success/20 text-success"
                      : "border-border bg-secondary hover:bg-secondary/70"
                  }`}
                >
                  <Check className="h-3 w-3" /> {done ? "Done" : "Mark done"}
                </button>
              </div>
              <ul className="space-y-1.5 mt-3">
                {s.actions.map((a, i) => (
                  <li key={i} className="text-xs flex items-start gap-2">
                    <span className="font-mono text-[10px] text-primary shrink-0 w-20">
                      {a.time}
                    </span>
                    <span className="flex-1">{a.do}</span>
                    <span className="text-muted-foreground italic shrink-0 hidden md:inline">
                      → {a.output}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-2 border-t border-border/50 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                Metric: <span className="text-foreground/80 normal-case font-sans">{s.metric}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CommWindows({
  pb,
  actorId,
  day,
}: {
  pb: RolePlaybook;
  actorId: string;
  day: ReturnType<typeof useConsoleDay>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section>
      <SectionHead
        icon={MessageSquare}
        title="Communication windows"
        subtitle={
          pb.shieldBlocks.length > 0
            ? "Send these on time. Outside these, Shield Mode applies."
            : "Send these messages on time. Tap to copy the template."
        }
      />
      <div className="space-y-2">
        {pb.commWindows.map((w) => {
          const sent = day.windowsSent[w.id];
          const m = nowMin();
          const overdue = !sent && m > w.atMin + 15;
          const due = !sent && m >= w.atMin - 5 && m <= w.atMin + 15;
          const isOpen = open === w.id;
          return (
            <div
              key={w.id}
              className={`rounded-lg border ${
                sent
                  ? "border-success/40 bg-success/5"
                  : overdue
                    ? "border-destructive/40 bg-destructive/5"
                    : due
                      ? "border-warning/40 bg-warning/5"
                      : "border-border bg-card"
              }`}
            >
              <button
                onClick={() => setOpen(isOpen ? null : w.id)}
                className="w-full p-3 flex items-center gap-3 text-left"
              >
                <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center shrink-0">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{w.label}</div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    {w.channel} · scheduled {fmtMin(w.atMin)}
                  </div>
                </div>
                <div className="text-right">
                  {sent ? (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-success inline-flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Sent{" "}
                      {new Date(sent).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : overdue ? (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-destructive inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Overdue
                    </span>
                  ) : due ? (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-warning">
                      Due now
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      Pending
                    </span>
                  )}
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-border p-3 space-y-2">
                  <pre className="whitespace-pre-wrap text-xs bg-secondary/40 rounded p-3 font-sans leading-relaxed">
                    {w.template}
                  </pre>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigator.clipboard?.writeText(w.template)}
                      className="h-8 px-3 inline-flex items-center gap-1.5 rounded border border-border hover:bg-secondary text-xs"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                    <button
                      onClick={() => markWindowSent(actorId, w.id)}
                      className="h-8 px-3 inline-flex items-center gap-1.5 rounded border border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium"
                    >
                      <Send className="h-3 w-3" /> Mark sent
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CollapseRule({ pb }: { pb: RolePlaybook }) {
  return (
    <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-destructive">
          Process collapse rule
        </span>
      </div>
      <p className="text-sm leading-relaxed">{pb.collapseRule}</p>
      <div className="mt-3 pt-3 border-t border-destructive/20 text-xs italic text-muted-foreground">
        {pb.interdependence}
      </div>
    </section>
  );
}

function DecisionsLog({
  actorId,
  day,
}: {
  actorId: string;
  day: ReturnType<typeof useConsoleDay>;
}) {
  const [text, setText] = useState("");
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Gavel className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold">Hard decisions today</h3>
      </div>
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g., Issued formal warning to X for second late entry."
          className="w-full text-sm bg-secondary/40 border border-border rounded p-2 min-h-[60px] resize-y"
        />
        <button
          onClick={() => {
            logDecision(actorId, text);
            setText("");
          }}
          disabled={!text.trim()}
          className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Log decision
        </button>
      </div>
      <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
        {day.decisions.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No hard decisions logged yet today. Easy decisions protect individuals; hard decisions
            protect Gharpayy.
          </p>
        ) : (
          day.decisions.map((d) => (
            <div
              key={d.id}
              className="text-xs bg-secondary/30 rounded p-2 border-l-2 border-primary"
            >
              <div className="font-mono text-[10px] text-muted-foreground">
                {new Date(d.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div>{d.text}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function EodGenerator({
  pb,
  actorId,
  day,
}: {
  pb: RolePlaybook;
  actorId: string;
  day: ReturnType<typeof useConsoleDay>;
}) {
  const [showPreview, setShowPreview] = useState(false);
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold">EOD Report</h3>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {pb.eodFields.map((f) => (
          <div key={f.id}>
            <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              {f.label}
            </label>
            {f.kind === "yesno" ? (
              <div className="flex gap-1 mt-0.5">
                {(["Yes", "No"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setEod(actorId, f.id, opt)}
                    className={`flex-1 h-7 text-xs rounded border ${
                      day.eod[f.id] === opt
                        ? opt === "Yes"
                          ? "border-success/40 bg-success/15 text-success"
                          : "border-destructive/40 bg-destructive/15 text-destructive"
                        : "border-border bg-secondary"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : f.kind === "number" ? (
              <input
                type="number"
                value={day.eod[f.id] ?? ""}
                onChange={(e) => setEod(actorId, f.id, e.target.value)}
                className="w-full h-8 px-2 text-sm bg-secondary/40 border border-border rounded mt-0.5"
              />
            ) : (
              <textarea
                value={day.eod[f.id] ?? ""}
                onChange={(e) => setEod(actorId, f.id, e.target.value)}
                placeholder={f.placeholder}
                rows={f.kind === "list" ? 2 : 1}
                className="w-full px-2 py-1 text-sm bg-secondary/40 border border-border rounded mt-0.5 resize-y"
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-border">
        <button
          onClick={() => setShowPreview((v) => !v)}
          className="flex-1 h-8 inline-flex items-center justify-center gap-1.5 rounded border border-border hover:bg-secondary text-xs"
        >
          {showPreview ? "Hide" : "Preview"}
        </button>
        <button
          onClick={() => {
            const text = exportEodText(actorId, pb.key as PlaybookKey);
            navigator.clipboard?.writeText(text);
          }}
          className="flex-1 h-8 inline-flex items-center justify-center gap-1.5 rounded bg-primary text-primary-foreground text-xs font-medium"
        >
          <Copy className="h-3 w-3" /> Copy report
        </button>
      </div>
      {showPreview && (
        <pre className="mt-3 text-[11px] bg-secondary/40 rounded p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
          {exportEodText(actorId, pb.key as PlaybookKey)}
        </pre>
      )}
      <div className="mt-3 text-[11px] text-muted-foreground">
        <Link to="/inbox" className="text-primary hover:underline">
          View inbox
        </Link>{" "}
        to send the digest.
      </div>
    </section>
  );
}

function SectionHead({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Target;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-primary" />
      <div>
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

// expose role list for debugging — referenced for tree-shake safety
export const __PLAYBOOK_KEYS__ = Object.keys(PLAYBOOKS);
