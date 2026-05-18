// AI daily summary — calls Lovable AI Gateway with the day's roll-up.
// No auth middleware: this is internal demo data, called from the Fly screen.
import { createServerFn } from "@tanstack/react-start";

type ZoneInput = {
  zone: string;
  calls: number;
  visitsScheduled: number;
  visitsCompleted: number;
  hotLeads: number;
  bookings: number;
  blockers: number;
  contributors: number;
};

type Input = {
  totals: {
    calls: number;
    visitsScheduled: number;
    visitsCompleted: number;
    hotLeads: number;
    bookings: number;
    blockers: number;
  };
  zones: ZoneInput[];
  topPerformer: { id: string; name: string } | null;
  submissions: number;
  teamSize: number;
  blockers: { author: string; zone: string; text: string }[];
  retro: { kind: "start" | "stop" | "continue"; body: string; upvotes: number }[];
  feed: { kind: string; author: string; body: string }[];
};

type SummaryOut = {
  bestZone: string;
  weakZone: string;
  topPerformer: string;
  topBlocker: string;
  hotLeadRisk: string;
  priorities: string[];
  oneLineForLeadership: string;
};

export const generateDailySummary = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => input)
  .handler(async ({ data }): Promise<{ summary: SummaryOut; raw: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY missing on server");
    }

    const system = `You are the operations chief-of-staff for Gharpayy Fly, a PG (paying-guest housing) field-ops team. You produce a one-page daily summary for leadership: terse, specific, action-oriented, no fluff, no emojis. Always return strict JSON matching the requested schema.`;

    const user = `Today's roll-up:
${JSON.stringify(data, null, 2)}

Produce JSON with EXACTLY these fields:
{
  "bestZone": "<zone name + one-line why>",
  "weakZone": "<zone name + one-line why>",
  "topPerformer": "<person name + one-line why>",
  "topBlocker": "<the single most repeated/severe blocker>",
  "hotLeadRisk": "<one-line risk on hot-lead inactivity or pending tokens>",
  "priorities": ["<priority 1 for tomorrow>", "<priority 2>", "<priority 3>"],
  "oneLineForLeadership": "<a single sentence summarising the day>"
}
Return ONLY the JSON, no prose.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 400)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "{}";

    let parsed: SummaryOut;
    try {
      parsed = JSON.parse(raw) as SummaryOut;
    } catch {
      parsed = {
        bestZone: "—",
        weakZone: "—",
        topPerformer: "—",
        topBlocker: "—",
        hotLeadRisk: "—",
        priorities: [],
        oneLineForLeadership: raw.slice(0, 240),
      };
    }
    return { summary: parsed, raw };
  });
