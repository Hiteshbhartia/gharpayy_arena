import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAttendanceState } from "@/hooks/useAttendance";
import { tierOf } from "@/lib/permissions";
import {
  SLOTS,
  type SlotKey,
  type SlotDef,
  activeSlot,
  complianceFor,
  getEntries,
  orgComplianceToday,
  submitPulse,
  subscribe,
  todayISO,
} from "@/lib/pulse-store";
import { Avatar } from "@/components/Avatar";
import { Clock, Send, CheckCircle2, AlertCircle, ChevronRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/pulse")({
  component: PulsePage,
});

function PulsePage() {
  const { actor } = useAttendanceState();
  const tier = tierOf(actor);
  const canSeeAll = tier === "leadership" || tier === "hr" || tier === "zone_leader" || tier === "leader";

  // re-render on store changes
  const [, setV] = useState(0);
  useEffect(() => subscribe(() => setV((x) => x + 1)), []);
  // tick once a minute so the active slot stays current
  useEffect(() => {
    const i = setInterval(() => setV((x) => x + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  const current = activeSlot();
  const mine = complianceFor(actor.id);
  const myEntries = useMemo(() => getEntries({ employeeId: actor.id, date: todayISO() }), [actor.id]);

  const [selected, setSelected] = useState<SlotKey>(current?.key ?? "slot1");
  useEffect(() => { if (current) setSelected(current.key); }, [current?.key]);

  return (
    <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto space-y-6">
      {/* Hero */}
      <header className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary mb-2">
              Gharpayy · Daily Pulse
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
              Three pulses. One brief. Every day.
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Submit each slot inside its window. Honesty over polish — your manager sees this in real time.
            </p>
          </div>
          {current ? (
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-right">
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Open now</div>
              <div className="font-display text-lg font-semibold">{current.label}</div>
              <div className="font-mono text-xs text-muted-foreground">{current.window}</div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-right">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">No slot open</div>
              <div className="text-xs text-muted-foreground mt-1">Between windows — catch your breath.</div>
            </div>
          )}
        </div>

        {/* Today strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6">
          {SLOTS.map((s) => {
            const done = mine.done.includes(s.key);
            const isActive = current?.key === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSelected(s.key)}
                className={`text-left rounded-xl border p-3 transition-all ${
                  selected === s.key
                    ? "border-primary bg-primary/10"
                    : done
                    ? "border-success/30 bg-success/5 hover:bg-success/10"
                    : isActive
                    ? "border-primary/40 bg-card hover:bg-primary/5"
                    : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {s.key === "eod" ? "EOD" : s.key.replace("slot", "Slot ")}
                  </div>
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  ) : isActive ? (
                    <Clock className="h-3.5 w-3.5 text-primary animate-pulse" />
                  ) : (
                    <span className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="font-display text-sm font-semibold mt-1 truncate">{s.label.split(" · ")[1] || s.label}</div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{s.window}</div>
              </button>
            );
          })}
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Submission */}
        <section className="lg:col-span-2">
          <SubmitCard slot={SLOTS.find((s) => s.key === selected)!} employeeId={actor.id} />

          {/* My day */}
          <div className="mt-6 rounded-2xl border border-border bg-card">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="font-display font-semibold">My day · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</div>
                <div className="text-xs text-muted-foreground">{myEntries.length} of 4 submitted</div>
              </div>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="divide-y divide-border">
              {SLOTS.map((s) => {
                const entry = myEntries.find((e) => e.slot === s.key);
                return (
                  <div key={s.key} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {s.label} · {s.window}
                      </div>
                      {entry ? (
                        <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                          entry.onTime ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"
                        }`}>
                          {entry.onTime ? "On time" : "Late"}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pending</span>
                      )}
                    </div>
                    {entry ? (
                      <div className="text-sm text-foreground/90 whitespace-pre-wrap">{entry.text}</div>
                    ) : (
                      <button onClick={() => setSelected(s.key)} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                        Write it now <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                    {entry && (entry.calls || entry.tours || entry.closures) ? (
                      <div className="flex gap-3 mt-2 text-xs font-mono text-muted-foreground">
                        {entry.calls != null && <span>{entry.calls} calls</span>}
                        {entry.tours != null && <span>{entry.tours} tours</span>}
                        {entry.closures != null && <span>{entry.closures} closures</span>}
                      </div>
                    ) : null}
                    {entry?.blockers && (
                      <div className="mt-2 text-xs rounded-md border border-destructive/20 bg-destructive/5 text-destructive px-2 py-1 inline-flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {entry.blockers}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right rail */}
        <aside className="space-y-6">
          <MyComplianceCard mine={mine} />
          {canSeeAll && <OrgComplianceCard />}
        </aside>
      </div>
    </div>
  );
}

function SubmitCard({ slot, employeeId }: { slot: SlotDef; employeeId: string }) {
  const existing = getEntries({ employeeId, date: todayISO(), slot: slot.key })[0];
  const [text, setText] = useState(existing?.text || "");
  const [calls, setCalls] = useState<string>(existing?.calls?.toString() || "");
  const [tours, setTours] = useState<string>(existing?.tours?.toString() || "");
  const [closures, setClosures] = useState<string>(existing?.closures?.toString() || "");
  const [blockers, setBlockers] = useState(existing?.blockers || "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const e = getEntries({ employeeId, date: todayISO(), slot: slot.key })[0];
    setText(e?.text || "");
    setCalls(e?.calls?.toString() || "");
    setTours(e?.tours?.toString() || "");
    setClosures(e?.closures?.toString() || "");
    setBlockers(e?.blockers || "");
    setSaved(false);
  }, [slot.key, employeeId]);

  function submit() {
    if (!text.trim()) return;
    submitPulse({
      employeeId,
      slot: slot.key,
      text,
      calls: calls ? Number(calls) : undefined,
      tours: tours ? Number(tours) : undefined,
      closures: closures ? Number(closures) : undefined,
      blockers,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-card to-primary/5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary">{slot.window}</div>
        <div className="font-display text-xl font-semibold mt-0.5">{slot.label}</div>
        <div className="text-sm text-muted-foreground mt-1">{slot.prompt}</div>
      </div>
      <div className="p-5 space-y-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Type it the way you'd say it on a call. No fluff."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="Calls"    value={calls}    onChange={setCalls} />
          <NumberField label="Tours"    value={tours}    onChange={setTours} />
          <NumberField label="Closures" value={closures} onChange={setClosures} />
        </div>
        <input
          value={blockers}
          onChange={(e) => setBlockers(e.target.value)}
          placeholder="Anything blocked? (optional)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {existing ? `Last saved · ${new Date(existing.submittedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Not submitted yet"}
          </div>
          <button
            onClick={submit}
            disabled={!text.trim()}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-3.5 w-3.5" /> {saved ? "Saved" : existing ? "Update" : "Submit pulse"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

function MyComplianceCard({ mine }: { mine: { done: SlotKey[]; missing: SlotKey[] } }) {
  const rate = Math.round((mine.done.length / SLOTS.length) * 100);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="font-display font-semibold">My compliance</div>
      <div className="text-xs text-muted-foreground">Today's submission rate</div>
      <div className="mt-3 flex items-end gap-2">
        <div className="font-display text-4xl font-semibold tabular-nums">{rate}<span className="text-xl text-muted-foreground">%</span></div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{mine.done.length} of {SLOTS.length}</div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
        <div className="h-full bg-gradient-to-r from-primary to-warning transition-all" style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

function OrgComplianceCard() {
  const rows = orgComplianceToday();
  const avg = Math.round(rows.reduce((a, r) => a + r.rate, 0) / Math.max(rows.length, 1));
  const lagging = rows.filter((r) => r.rate < 100).slice(0, 6);
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display font-semibold">Org pulse</div>
            <div className="text-xs text-muted-foreground">Live · today</div>
          </div>
          <div className="font-display text-2xl font-semibold tabular-nums">{avg}<span className="text-base text-muted-foreground">%</span></div>
        </div>
      </div>
      <div className="divide-y divide-border max-h-80 overflow-y-auto">
        {lagging.length === 0 ? (
          <div className="p-5 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-2" />
            Everyone is on track.
          </div>
        ) : lagging.map((r) => (
          <div key={r.employeeId} className="px-5 py-3 flex items-center gap-3">
            <Avatar id={r.employeeId} size={28} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{r.name}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground truncate">{r.role} · {r.team}</div>
            </div>
            <div className={`font-mono text-xs tabular-nums ${r.rate < 50 ? "text-destructive" : r.rate < 80 ? "text-warning" : "text-foreground"}`}>
              {r.rate}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
