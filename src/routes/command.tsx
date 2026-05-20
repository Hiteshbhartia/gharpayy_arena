import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Send, Flame, Loader2 } from "lucide-react";
import { teamSummary } from "@/lib/team-metrics";
import { getRoster } from "@/lib/roster";
import { RoleGate } from "@/components/RoleGate";

export const Route = createFileRoute("/command")({
  component: () => (
    <RoleGate allow={["leadership", "hr", "leader"]}>
      <CommandCenter />
    </RoleGate>
  ),
  head: () => ({ meta: [{ title: "Command Center — Gharpayy Core AI" }] }),
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Who are my A players today and why?",
  "Diagnose Vikram Joshi. Give me the exact corrective action.",
  "Generate today's war room summary.",
  "Which leads are at risk of being lost? What's the next action?",
];

function CommandCenter() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    const snapshot = {
      summary: teamSummary(getRoster()),
      employees: getRoster(),
    };

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/core-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next, snapshot }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("Rate limited. Try again in a moment.");
        if (resp.status === 402) throw new Error("AI credits exhausted. Add funds to workspace.");
        throw new Error("AI brain offline.");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantText = "";
      setMessages((p) => [...p, { role: "assistant", content: "" }]);

      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        textBuffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, nl);
          textBuffer = textBuffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages((p) =>
                p.map((m, i) => (i === p.length - 1 ? { ...m, content: assistantText } : m)),
              );
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Unknown error"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-background/50">
      <header className="px-6 md:px-12 py-8 border-b border-border/40 bg-card/40 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <div className="h-12 w-12 rounded-xl bg-primary shadow-lg shadow-primary/20 flex items-center justify-center shrink-0">
            <Flame className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Command Center</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
              Central operating intelligence · live snapshot loaded
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full px-4 md:px-8 py-8 md:py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {messages.length === 0 && (
            <div className="text-center py-16 md:py-24">
              <div className="font-display text-3xl font-semibold mb-3 tracking-tight">
                Ask the brain.
              </div>
              <p className="text-muted-foreground text-base mb-12">
                Direct. Measurable. Actionable. No fluff.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left p-5 rounded-xl border border-border/60 bg-card/50 hover:border-primary/50 hover:bg-primary/5 hover:shadow-md transition-all group"
                  >
                    <span className="text-sm font-medium text-foreground/90 group-hover:text-primary transition-colors leading-relaxed">
                      {s}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[90%] md:max-w-[85%] rounded-2xl px-6 py-5 text-[15px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                    : "bg-card border border-border/50 shadow-sm"
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">
                  {m.content ||
                    (loading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Synthesizing...</span>
                      </div>
                    ) : (
                      ""
                    ))}
                </div>
              </div>
            </div>
          ))}
          <div ref={scrollRef} className="h-4" />
        </div>
      </div>

      <div className="sticky bottom-0 z-20 w-full bg-gradient-to-t from-background via-background to-transparent pt-12 pb-6 md:pb-8 px-4 md:px-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="max-w-4xl mx-auto relative flex flex-col sm:flex-row gap-3 items-end sm:items-center rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl p-2 md:p-3 transition-all focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Executive query... (e.g. Diagnose team productivity)"
            className="flex-1 w-full px-4 py-3 bg-transparent text-base md:text-lg focus:outline-none placeholder:text-muted-foreground/60"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold tracking-wide hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Execute
          </button>
        </form>
      </div>
    </div>
  );
}
