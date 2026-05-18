import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import type { Tier as PerfTier, Employee } from "@/types/hr";
import { teamSummary, tierFor } from "@/lib/team-metrics";
import { getRoster } from "@/lib/roster";
import { tierOf, TIER_LABEL, TIER_TAGLINE } from "@/lib/permissions";
import { useAttendanceState } from "@/hooks/useAttendance";
import { computeScore } from "@/lib/score-engine";
import { tasksFor, toggleSubtask, setStatus as setTaskStatus } from "@/lib/task-store";
import { useLeaves } from "@/lib/leave-store";
import { useNotifications } from "@/lib/notification-store";
import { useCalendarEvents } from "@/lib/calendar-store";
import { liveStatusFor, todaySummary, fmtDuration } from "@/lib/attendance-store";
import { lastNDays } from "@/lib/day-score";
import { Avatar } from "@/components/Avatar";
import { AttendancePanel } from "@/components/AttendancePanel";
import { MissionBrief } from "@/components/MissionBrief";
import { Progress } from "@/components/ui/progress";
import {
  ArrowDown,
  ArrowUp,
  Flame,
  Target,
  IndianRupee,
  Phone,
  TrendingUp,
  AlertTriangle,
  CheckSquare,
  Calendar as CalIcon,
  PlaneTakeoff,
  Users,
  Cake,
  Trophy,
  Clock,
  Square,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: ArenaHome,
});

const tierColor: Record<PerfTier, string> = {
  A: "bg-success/10 text-success border-success/20",
  B: "bg-info/10 text-info border-info/20",
  C: "bg-warning/15 text-warning border-warning/30",
  D: "bg-destructive/10 text-destructive border-destructive/20",
};

const inr = (n: number) =>
  "₹" + (n >= 100000 ? (n / 100000).toFixed(1) + "L" : n.toLocaleString("en-IN"));

// ============ Shared building blocks ============

function HomeHeader({ actor, sub }: { actor: Employee; sub: string }) {
  const tier = tierOf(actor);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <header className="mb-5">
      <div className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-primary mb-2">
        {TIER_LABEL[tier]} · Core Arena
      </div>
      <h1 className="font-display text-2xl md:text-4xl font-semibold leading-tight">
        {greet}, {actor.name.split(" ")[0]}.
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">{sub}</p>
    </header>
  );
}

function PillarHeader({
  kicker,
  title,
  href,
  icon: Icon,
}: {
  kicker: string;
  title: string;
  href: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {kicker}
          </div>
          <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
        </div>
      </div>
      <Link to={href} className="text-[11px] text-primary font-mono uppercase tracking-widest">
        Open →
      </Link>
    </div>
  );
}

function Bar({ value, color = "bg-primary" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

// ============ Hero Pillars (Time / Tasks / Goals) — used by everyone ============

function TimePillar({ actor }: { actor: Employee }) {
  const summary = todaySummary(actor.id);
  const status = summary.status;
  const statusColor =
    status === "Clocked In"
      ? "text-success"
      : status === "On Break"
        ? "text-warning"
        : status === "In Field"
          ? "text-primary"
          : "text-muted-foreground";

  return (
    <section className="rounded-xl bg-card border border-border p-4 md:p-5">
      <PillarHeader kicker="Pillar 01" title="Time" href="/attendance" icon={Clock} />
      <div className="flex items-baseline justify-between mb-3">
        <div className="font-display text-2xl md:text-3xl font-semibold tabular-nums">
          {fmtDuration(summary.workMs)}
        </div>
        <div className={`font-mono text-[10px] uppercase tracking-widest ${statusColor}`}>
          {status}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-4">
        <div className="rounded-md bg-muted/40 border border-border py-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            Work
          </div>
          <div className="text-sm font-semibold tabular-nums">{fmtDuration(summary.workMs)}</div>
        </div>
        <div className="rounded-md bg-muted/40 border border-border py-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            Break
          </div>
          <div className="text-sm font-semibold tabular-nums">{fmtDuration(summary.breakMs)}</div>
        </div>
        <div className="rounded-md bg-muted/40 border border-border py-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            Field
          </div>
          <div className="text-sm font-semibold tabular-nums">{fmtDuration(summary.fieldMs)}</div>
        </div>
      </div>
      <Link
        to="/attendance"
        className="block w-full text-center py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium"
      >
        {status === "Off" ? "Punch In Now" : "Manage Punch"}
      </Link>
    </section>
  );
}

function TasksPillar({ actor }: { actor: Employee }) {
  const tasks = tasksFor(actor.id);
  const open = tasks.filter((t) => t.status !== "done");
  const todo = tasks.filter((t) => t.status === "todo").length;
  const doing = tasks.filter((t) => t.status === "doing").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length || 1;
  const pct = Math.round((done / total) * 100);

  // Find the next subtask the user can knock off in one tap
  const nextWithSub = open.find(
    (t) => (t.subtasks?.length ?? 0) > 0 && t.subtasks!.some((s) => !s.done),
  );
  const nextSub = nextWithSub?.subtasks?.find((s) => !s.done);

  return (
    <section className="rounded-xl bg-card border border-border p-4 md:p-5">
      <PillarHeader kicker="Pillar 02" title="Tasks" href="/tasks" icon={CheckSquare} />
      <div className="flex items-baseline justify-between mb-2">
        <div className="font-display text-2xl md:text-3xl font-semibold tabular-nums">
          {open.length}
          <span className="text-base text-muted-foreground font-normal"> open</span>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {pct}% done
        </div>
      </div>
      <Progress value={pct} className="h-1.5 mb-4" />
      <div className="grid grid-cols-3 gap-2 text-center mb-4">
        <div className="rounded-md bg-muted/40 border border-border py-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            To do
          </div>
          <div className="text-sm font-semibold tabular-nums">{todo}</div>
        </div>
        <div className="rounded-md bg-muted/40 border border-border py-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            Doing
          </div>
          <div className="text-sm font-semibold tabular-nums">{doing}</div>
        </div>
        <div className="rounded-md bg-muted/40 border border-border py-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            Done
          </div>
          <div className="text-sm font-semibold tabular-nums">{done}</div>
        </div>
      </div>
      {nextWithSub && nextSub ? (
        <button
          onClick={() => toggleSubtask(nextWithSub.id, nextSub.id, actor.id)}
          className="w-full flex items-center gap-2 text-left p-3 rounded-md border border-border bg-background hover:bg-muted/30 transition"
        >
          <Square className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground truncate">
              {nextWithSub.title}
            </div>
            <div className="text-sm font-medium truncate">{nextSub.title}</div>
          </div>
        </button>
      ) : open[0] ? (
        <button
          onClick={() => setTaskStatus(open[0].id, "done", actor.id)}
          className="w-full flex items-center gap-2 text-left p-3 rounded-md border border-border bg-background hover:bg-muted/30 transition"
        >
          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Next up
            </div>
            <div className="text-sm font-medium truncate">{open[0].title}</div>
          </div>
        </button>
      ) : (
        <div className="text-center text-sm text-muted-foreground py-3">All clear today 🎉</div>
      )}
    </section>
  );
}

function GoalsPillar({ actor }: { actor: Employee }) {
  const score = computeScore(actor);
  const tier = tierFor(score.total);
  const days = useMemo(() => lastNDays(actor, 7), [actor]);
  const max = Math.max(100, ...days.map((d) => d.total));

  return (
    <section className="rounded-xl bg-card border border-border p-4 md:p-5">
      <PillarHeader kicker="Pillar 03" title="Goals" href="/score" icon={Trophy} />
      <div className="flex items-baseline justify-between mb-3">
        <div className="font-display text-2xl md:text-3xl font-semibold tabular-nums">
          {score.total}
          <span className="text-base text-muted-foreground font-normal">/100</span>
        </div>
        <span
          className={`inline-flex items-center justify-center h-7 w-7 rounded-md border font-mono font-semibold text-xs ${tierColor[tier]}`}
        >
          {tier}
        </span>
      </div>
      <div className="flex items-end gap-1 h-14 mb-4">
        {days.map((d) => {
          const h = Math.max(8, (d.total / max) * 56);
          const isToday = d.dayKey === days[days.length - 1].dayKey;
          return (
            <Link
              key={d.dayKey}
              to="/score"
              className="flex-1 flex flex-col items-center gap-1 group"
              title={`${d.label} · ${d.total}`}
            >
              <div
                className={`w-full rounded-sm transition ${isToday ? "bg-primary" : "bg-muted-foreground/40 group-hover:bg-muted-foreground/70"}`}
                style={{ height: `${h}px` }}
              />
            </Link>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-muted/40 border border-border p-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            Attendance
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-sm font-semibold tabular-nums">{score.attendance}</span>
            <Bar value={score.attendance} color="bg-success" />
          </div>
        </div>
        <div className="rounded-md bg-muted/40 border border-border p-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            On-time tasks
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-sm font-semibold tabular-nums">{score.taskOnTime}</span>
            <Bar value={score.taskOnTime} color="bg-info" />
          </div>
        </div>
        <div className="rounded-md bg-muted/40 border border-border p-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            Role KPI
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-sm font-semibold tabular-nums">{score.roleKpi}</span>
            <Bar value={score.roleKpi} color="bg-warning" />
          </div>
        </div>
        <div className="rounded-md bg-muted/40 border border-border p-2">
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            Kudos
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-sm font-semibold tabular-nums">{score.kudos}</span>
            <Bar value={score.kudos} color="bg-primary" />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroPillars({ actor }: { actor: Employee }) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6">
      <TimePillar actor={actor} />
      <TasksPillar actor={actor} />
      <GoalsPillar actor={actor} />
    </section>
  );
}

// ============ Pod-level rollup of the same three pillars (Leader/HR/Leadership) ============

function PodPillars({ pod, label }: { pod: Employee[]; label: string }) {
  const stats = useMemo(() => {
    let onClock = 0,
      onBreak = 0,
      inField = 0;
    let openTasks = 0,
      doneToday = 0;
    let totalScore = 0,
      atRisk = 0;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    for (const e of pod) {
      const s = todaySummary(e.id).status;
      if (s === "Clocked In") onClock++;
      else if (s === "On Break") onBreak++;
      else if (s === "In Field") inField++;
      const ts = tasksFor(e.id);
      openTasks += ts.filter((t) => t.status !== "done").length;
      doneToday += ts.filter(
        (t) => t.status === "done" && (t.completedAt ?? 0) >= startOfDay.getTime(),
      ).length;
      const sc = computeScore(e).total;
      totalScore += sc;
      if (sc < 60) atRisk++;
    }
    const avg = pod.length ? Math.round(totalScore / pod.length) : 0;
    return { onClock, onBreak, inField, openTasks, doneToday, avg, atRisk, total: pod.length };
  }, [pod]);

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6">
      <div className="rounded-xl bg-card border border-border p-4 md:p-5">
        <PillarHeader
          kicker={`${label} · Pillar 01`}
          title="Time on the floor"
          href="/attendance"
          icon={Clock}
        />
        <div className="font-display text-2xl md:text-3xl font-semibold tabular-nums">
          {stats.onClock + stats.inField}
          <span className="text-base text-muted-foreground font-normal">/{stats.total}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 mb-3">active right now</div>
        <div className="flex gap-2 text-[10px] font-mono uppercase tracking-widest">
          <span className="px-2 py-1 rounded bg-success/10 text-success">In {stats.onClock}</span>
          <span className="px-2 py-1 rounded bg-warning/15 text-warning">
            Break {stats.onBreak}
          </span>
          <span className="px-2 py-1 rounded bg-primary/10 text-primary">
            Field {stats.inField}
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-card border border-border p-4 md:p-5">
        <PillarHeader
          kicker={`${label} · Pillar 02`}
          title="Task throughput"
          href="/tasks"
          icon={CheckSquare}
        />
        <div className="font-display text-2xl md:text-3xl font-semibold tabular-nums">
          {stats.doneToday}
        </div>
        <div className="text-xs text-muted-foreground mt-1 mb-3">
          completed today · {stats.openTasks} still open
        </div>
        <Bar
          value={
            stats.doneToday + stats.openTasks > 0
              ? (stats.doneToday / (stats.doneToday + stats.openTasks)) * 100
              : 0
          }
          color="bg-info"
        />
      </div>

      <div className="rounded-xl bg-card border border-border p-4 md:p-5">
        <PillarHeader
          kicker={`${label} · Pillar 03`}
          title="Goal attainment"
          href="/score"
          icon={Trophy}
        />
        <div className="font-display text-2xl md:text-3xl font-semibold tabular-nums">
          {stats.avg}
          <span className="text-base text-muted-foreground font-normal">/100</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 mb-3">
          avg score · {stats.atRisk} below 60
        </div>
        <Bar
          value={stats.avg}
          color={stats.avg > 75 ? "bg-success" : stats.avg > 60 ? "bg-info" : "bg-warning"}
        />
      </div>
    </section>
  );
}

// ============ Role homes — every one leads with the pillars ============

function TeammateHome({ actor }: { actor: Employee }) {
  const events = useCalendarEvents();
  const todayEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          (e.withIds?.includes(actor.id) || e.ownerId === actor.id) &&
          new Date(e.startAt).toDateString() === new Date().toDateString(),
      ),
    [events, actor.id],
  );
  const notifs = useNotifications(actor.id)
    .filter((n) => !n.read)
    .slice(0, 3);
  const myTasks = tasksFor(actor.id)
    .filter((t) => t.status !== "done")
    .slice(0, 4);

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1200px] mx-auto">
      <HomeHeader
        actor={actor}
        sub={`Time, Tasks, Goals — your three pillars. ${TIER_TAGLINE.teammate}`}
      />
      <MissionBrief actor={actor} />
      <HeroPillars actor={actor} />

      <div className="grid md:grid-cols-2 gap-4">
        <section className="rounded-xl bg-card border border-border p-5">
          <PillarHeader
            kicker="Detail"
            title="Today's task list"
            href="/tasks"
            icon={CheckSquare}
          />
          {myTasks.map((t) => (
            <div key={t.id} className="py-2 border-b border-border last:border-0">
              <div className="text-sm font-medium">{t.title}</div>
              <div className="text-[11px] text-muted-foreground font-mono uppercase">
                {t.priority} · due{" "}
                {new Date(t.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))}
          {myTasks.length === 0 && (
            <div className="text-sm text-muted-foreground">
              All clear. Pick up a kudo or coach a teammate.
            </div>
          )}
        </section>

        <section className="rounded-xl bg-card border border-border p-5">
          <PillarHeader kicker="Detail" title="Heads up" href="/inbox" icon={CalIcon} />
          {notifs.length === 0 && (
            <div className="text-sm text-muted-foreground">Quiet inbox. Nice.</div>
          )}
          {notifs.map((n) => (
            <div key={n.id} className="py-2 border-b border-border last:border-0">
              <div className="text-sm font-medium">{n.title}</div>
              <div className="text-xs text-muted-foreground">{n.body}</div>
            </div>
          ))}
          {todayEvents.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Today on your calendar
              </div>
              {todayEvents.map((e) => (
                <div key={e.id} className="text-sm">
                  {e.title}{" "}
                  <span className="text-muted-foreground">
                    ·{" "}
                    {new Date(e.startAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function LeaderHome({ actor }: { actor: Employee }) {
  const pod = useMemo(
    () =>
      getRoster()
        .filter((e) => e.managerId === actor.id || e.team === actor.team)
        .filter((e) => e.id !== actor.id),
    [actor.id, actor.team],
  );
  const leaves = useLeaves().filter(
    (l) => l.status === "pending" && pod.some((p) => p.id === l.employeeId),
  );
  const sorted = [...pod].sort((a, b) => computeScore(b).total - computeScore(a).total);

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1300px] mx-auto">
      <HomeHeader
        actor={actor}
        sub={`Your pod's Time, Tasks, Goals at a glance. ${TIER_TAGLINE.leader}`}
      />
      <MissionBrief actor={actor} />

      {/* Personal pillars first — leaders punch in too */}
      <HeroPillars actor={actor} />

      {/* Then the pod rollup of the same three pillars */}
      <PodPillars pod={pod} label="Pod" />

      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-4 md:px-5 py-3 md:py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Pod leaderboard</h2>
          <Link to="/war-room" className="text-xs text-primary font-mono uppercase tracking-widest">
            War Room →
          </Link>
        </div>
        <div className="divide-y divide-border">
          {sorted.map((e, i) => {
            const sc = computeScore(e);
            const t = tierFor(sc.total);
            return (
              <div key={e.id} className="px-4 md:px-5 py-3 flex items-center gap-3">
                <div className="font-mono text-xs text-muted-foreground w-6">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <Avatar id={e.id} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{e.name}</div>
                  <div className="text-[11px] text-muted-foreground">{e.role}</div>
                </div>
                <span
                  className={`hidden sm:inline-flex items-center justify-center h-7 w-7 rounded-md border font-mono font-semibold text-xs ${tierColor[t]}`}
                >
                  {t}
                </span>
                <div className="w-24 hidden md:block">
                  <Bar
                    value={sc.total}
                    color={
                      sc.total > 85
                        ? "bg-success"
                        : sc.total > 70
                          ? "bg-info"
                          : sc.total > 55
                            ? "bg-warning"
                            : "bg-destructive"
                    }
                  />
                </div>
                <div className="font-mono text-sm w-10 text-right">{sc.total}</div>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <div className="px-5 py-6 text-sm text-muted-foreground">
              No teammates assigned to your pod yet.
            </div>
          )}
        </div>
      </section>

      {leaves.length > 0 && (
        <section className="mt-6 rounded-xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold">Approvals waiting on you</h2>
            <Link to="/leaves" className="text-xs text-primary font-mono uppercase tracking-widest">
              Open queue →
            </Link>
          </div>
          {leaves.slice(0, 4).map((l) => {
            const emp = getRoster().find((e) => e.id === l.employeeId);
            return (
              <div key={l.id} className="py-2 border-b border-border last:border-0 text-sm">
                <span className="font-medium">{emp?.name}</span> · {l.type} · {l.startDate}
                {l.startDate !== l.endDate && ` → ${l.endDate}`}
                <div className="text-xs text-muted-foreground">{l.reason}</div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function HRHome({ actor }: { actor: Employee }) {
  const leaves = useLeaves().filter((l) => l.status === "pending");
  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const birthdays = getRoster().filter((e) => e.birthdayMMDD === mmdd);
  const newJoiners = getRoster().filter((e) => (e.joinedYearsAgo ?? 99) === 0);
  const lowAttendance = getRoster()
    .filter((e) => e.attendance < 80)
    .sort((a, b) => a.attendance - b.attendance);
  const flagged = getRoster().filter((e) => e.flags.length > 0);

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1300px] mx-auto">
      <HomeHeader actor={actor} sub={`Time, Tasks, Goals across the org. ${TIER_TAGLINE.hr}`} />
      <MissionBrief actor={actor} />

      {/* Org-wide rollup of the three pillars */}
      <PodPillars pod={getRoster()} label="Org" />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Headcount
            </span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{getRoster().length}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {newJoiners.length} new this year
          </div>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Leaves Pending
            </span>
            <PlaneTakeoff className="h-4 w-4 text-warning" />
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{leaves.length}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">awaiting review</div>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Attendance Risk
            </span>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{lowAttendance.length}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">below 80%</div>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Birthdays
            </span>
            <Cake className="h-4 w-4 text-info" />
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{birthdays.length}</div>
          <div className="mt-1 text-[11px] text-muted-foreground truncate">
            {birthdays.map((b) => b.name.split(" ")[0]).join(", ") || "—"}
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="rounded-xl bg-card border border-border p-5">
          <PillarHeader kicker="Time" title="Leave queue" href="/leaves" icon={PlaneTakeoff} />
          {leaves.length === 0 && (
            <div className="text-sm text-muted-foreground">Inbox zero. Beautiful.</div>
          )}
          {leaves.slice(0, 5).map((l) => {
            const emp = getRoster().find((e) => e.id === l.employeeId);
            return (
              <div key={l.id} className="py-2 border-b border-border last:border-0 text-sm">
                <span className="font-medium">{emp?.name}</span> · {l.type} · {l.startDate}
                <div className="text-xs text-muted-foreground">{l.reason}</div>
              </div>
            );
          })}
        </section>

        <section className="rounded-xl bg-card border border-border p-5">
          <PillarHeader kicker="Goals" title="People at risk" href="/people" icon={AlertTriangle} />
          {flagged.slice(0, 5).map((e) => (
            <div
              key={e.id}
              className="py-2 border-b border-border last:border-0 flex items-center gap-3"
            >
              <Avatar id={e.id} size={28} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {e.name} <span className="text-muted-foreground font-normal">· {e.role}</span>
                </div>
                <div className="text-[11px] text-destructive">{e.flags.join(" · ")}</div>
              </div>
              <span className="font-mono text-xs">{e.attendance}%</span>
            </div>
          ))}
          {flagged.length === 0 && (
            <div className="text-sm text-muted-foreground">No flags raised. Send a kudo today.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function LeadershipHome({ actor }: { actor: Employee }) {
  const s = teamSummary(getRoster());
  const sorted = [...getRoster()].sort((a, b) => b.performance - a.performance);
  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
      <HomeHeader actor={actor} sub={`Org-wide Time, Tasks, Goals. ${TIER_TAGLINE.leadership}`} />
      <MissionBrief actor={actor} />

      {/* The three pillars, org-wide, are the headline */}
      <PodPillars pod={getRoster()} label="Org" />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Revenue Today
            </span>
            <IndianRupee className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{inr(s.totalRevenue)}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{s.totalDeals} deals</div>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Calls Made
            </span>
            <Phone className="h-4 w-4 text-info" />
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{s.totalCalls}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">across all pods</div>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Active Leads
            </span>
            <Target className="h-4 w-4 text-warning" />
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{s.totalLeads}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">in pipeline</div>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              A-Players
            </span>
            <Flame className="h-4 w-4 text-success" />
          </div>
          <div className="mt-2 font-display text-2xl font-semibold">{s.counts.A}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            B:{s.counts.B} C:{s.counts.C} D:{s.counts.D}
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl bg-card border border-border p-5">
          <div className="flex items-center gap-2 text-success mb-3">
            <ArrowUp className="h-4 w-4" />
            <span className="text-xs font-mono uppercase tracking-widest">Top Performer</span>
          </div>
          <div className="font-display text-xl font-semibold">{s.top?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground mb-3">
            {s.top ? `${s.top.role} · ${inr(s.top.revenueImpact)}` : ""}
          </div>
          {s.top && <Bar value={s.top.performance} color="bg-success" />}
        </div>
        <div className="rounded-xl bg-card border border-border p-5">
          <div className="flex items-center gap-2 text-destructive mb-3">
            <ArrowDown className="h-4 w-4" />
            <span className="text-xs font-mono uppercase tracking-widest">Replace Signal</span>
          </div>
          <div className="font-display text-xl font-semibold">{s.bottom?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground mb-3">
            {s.bottom ? `${s.bottom.role} · ${s.bottom.flags.length} flags` : ""}
          </div>
          {s.bottom && <Bar value={s.bottom.performance} color="bg-destructive" />}
        </div>
        <div className="rounded-xl bg-sidebar text-sidebar-foreground border border-sidebar-border p-5">
          <div className="flex items-center gap-2 text-primary mb-3">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-mono uppercase tracking-widest">Today's Call</span>
          </div>
          <p className="text-sm text-white leading-relaxed">
            Floor needs{" "}
            <span className="text-primary font-semibold">{Math.max(0, 200 - s.totalCalls)}</span>{" "}
            more calls to hit shift target. Reassign Devansh's pool to Karan.
          </p>
          <Link
            to="/war-room"
            className="mt-4 inline-block text-xs font-mono uppercase tracking-widest text-primary"
          >
            Open War Room →
          </Link>
        </div>
      </section>

      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Live leaderboard</h2>
          <Link to="/people" className="text-xs text-primary font-mono uppercase tracking-widest">
            All people →
          </Link>
        </div>
        <div className="divide-y divide-border">
          {sorted.slice(0, 6).map((e, i) => {
            const t = tierFor(e.performance);
            return (
              <div key={e.id} className="px-4 md:px-5 py-3 flex items-center gap-3">
                <div className="font-mono text-xs text-muted-foreground w-6">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <Avatar id={e.id} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{e.name}</div>
                  <div className="text-[11px] text-muted-foreground">{e.role}</div>
                </div>
                <span
                  className={`hidden sm:inline-flex items-center justify-center h-7 w-7 rounded-md border font-mono font-semibold text-xs ${tierColor[t]}`}
                >
                  {t}
                </span>
                <div className="font-mono text-sm w-10 text-right">{e.performance}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ArenaHome() {
  const { actor } = useAttendanceState();
  const tier = tierOf(actor);
  if (tier === "partner") {
    if (typeof window !== "undefined") window.location.replace("/partner");
    return null;
  }
  if (tier === "zone_leader") {
    if (typeof window !== "undefined") window.location.replace("/zones");
    return null;
  }
  if (tier === "leadership") return <LeadershipHome actor={actor} />;
  if (tier === "hr") return <HRHome actor={actor} />;
  if (tier === "leader") return <LeaderHome actor={actor} />;
  return <TeammateHome actor={actor} />;
}
