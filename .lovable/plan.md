
# Gharpayy Arena — Connected HRMS for the Whole Team

This isn't a tracker. It's an **Arena**: every person sees their mission, their score, their squad, and their next move — all in one place. Role-aware. Notification-driven. Calendar-native. AI-coached.

Built as a no-auth demo (use the "Acting as" switcher to jump between roles), all data lives in browser storage, ready to swap to real backend later.

---

## The 8 roles from your playbook are all first-class

Admin · Sales Lead · Sales Agent · Flow Ops · TCM · HR · Owner · Coach (AI). Each gets a tailored home screen, but they all share one shell, one calendar, one notification stream, one language.

---

## What gets built

### 1. Arena Home (role-aware dashboard) — `/`
The first thing every person sees when they open Gharpayy. Replaces the generic landing.

- **"Today's Mission" hero** — 3 things this person must do today, generated from role + open tasks + pending tours/leads/leaves.
- **Live pulse strip** — your attendance status, your streak (days on time), your rank in your squad, kudos received this week.
- **Squad rail** — small avatars of teammates with live presence dots (clocked in / on break / in field / off). Click → their day.
- **Coach nudge card** — one AI-generated sentence: "You're 2 follow-ups behind today's pace. Knock them out before lunch."
- **Calendar peek** — next 3 events from the unified calendar.
- **Recognition feed** — last 3 kudos given in the company. Makes it feel alive.

### 2. Unified Calendar — `/calendar`
One calendar, every event type, color-coded.

- Shifts (your shift block), breaks, holidays, leaves (yours + team), tours scheduled, tasks with due dates, 1:1s, town halls, birthdays, work anniversaries.
- Day / Week / Month views.
- Click any event → drawer with full context, related people, quick actions (reschedule, mark done, message owner).
- "Add to my day" quick-create: meeting, focus block, field visit, personal reminder.
- Conflict detection: warns if you book over a shift break or a confirmed tour.

### 3. Notification Center — top-bar bell + `/inbox`
Persistent, never miss anything.

- **Inbox** style: unread count, grouped by type (Mentions, Approvals, Tasks, Attendance alerts, Kudos, Coach nudges, System).
- Bell dropdown with last 10 + "See all".
- Each notification: who, what, when, one-click action (Approve, Open, Dismiss, Snooze).
- Toast popups for real-time events (someone clocked in late, lead reassigned to you, leave approved).
- Filter pills, mark-all-read, snooze-until-tomorrow.
- Per-user preferences (mock UI): which event types push toast vs. just inbox.

### 4. Email-style digest preview — `/inbox/digests`
Mock the actual emails the system would send so the user can see "what HR would receive at 9am" — daily standup digest, weekly score card, monthly attendance report. Each rendered as a real email card with subject + body + preview-in-modal.

### 5. People — `/people`
Full directory replacing the thin "team" route.

- Searchable grid with filters: role, zone, shift, status.
- Profile drawer per person: bio, role, manager, squad, current shift, attendance score (last 30 days), tasks open, leaves taken, kudos received, recent activity timeline.
- Quick actions visible only to managers/HR: assign task, send notice, give kudos, request 1:1.

### 6. Attendance — keep current `/attendance` + `/roster`, add layers
- Roster gets a **map view tab** with live pins + selfies (already in the file).
- Add **per-day report drawer**: timeline of events for that day, total work / break / field minutes, selfie strip across the day, late/early flags, anomalies highlighted.
- Add **anomaly inbox** for HR: missed clock-out, no selfie, location outside zone — with one-click "Ask employee" that drops a message in their notification inbox.

### 7. Tasks & Workflows — `/tasks`
Beyond a checkbox list — this is how work flows.

- Personal Kanban (Todo / Doing / Done / Blocked).
- "Assigned by me" tab for managers.
- Each task: assignee, due date+time, priority, attachments, comments, related lead/tour/property.
- Auto-tasks generated from playbook handoffs (e.g., when a tour is marked complete, a "Push draft agreement" task auto-appears for the Sales Agent — straight from your playbook flow).
- Recurring tasks (daily check-in, weekly report).

### 8. Leaves & Time Off — `/leaves`
- Apply: type, dates, half-day, reason. See live balance and team conflicts.
- Approval queue for managers with one-click approve/reject + note.
- Team availability calendar showing who's out when.
- Auto-notification + auto-calendar entry on approval.

### 9. Recognition / Kudos — `/kudos`
The "feel worthy" layer.

- Give kudos to anyone, pick a value tag (Hustle / Customer Love / Team Player / Above & Beyond / Bug Fixer), one line of why.
- Public feed (everyone sees), personal trophy case on profile.
- Weekly leaderboard of kudos received — feeds into the Arena Home pulse.
- Auto-kudos from system: streak milestones (30-day on-time streak), score tier promotions.

### 10. Performance / Score Card — `/score`
Each person's own page; managers see anyone they manage.

- Composite score = attendance (40%) + tasks completed on time (30%) + kudos (15%) + role-specific KPI (15%, e.g., tours conducted for TCM, leads closed for Sales Agent).
- Tier band (A/B/C/D) — already in your seed.
- Trend chart last 8 weeks.
- "What changed" callouts: "+4 points this week — you closed 3 follow-ups under SLA."
- Goals section: 2–3 active goals with progress bars.

### 11. War Room / Live Ops — `/war-room` (HR + Admin + Sales Lead + Flow Ops)
The "command bridge" — wall-mountable.

- Live leaderboard (A/B/C/D tiers).
- Today's attendance map with live selfie tiles.
- Open critical issues feed (escalations, breaches).
- Right rail: real-time event ticker (lead.assigned, tour.completed, payment.received) — even if mocked.

### 12. Coach (AI Command Center) — keep current `/command`, level it up
- Pre-loaded prompt chips per role: "Who's at risk of missing target?", "Who deserves kudos this week?", "Draft a polite nudge for late check-ins".
- Streams answers from Lovable AI Gateway with the master prompt as system prompt.
- Coach also fires nudges into the notification inbox automatically (mocked schedule).

### 13. Settings & Preferences — `/settings`
- Notification preferences per channel.
- Calendar sync UI (mock — "Connect Google Calendar" button shows a confirm modal).
- Quiet hours.
- Theme (light/dark — keep app's existing dark theme as default).
- "Acting as" role switcher lives here too (in addition to the top-bar one).

### 14. Top-bar shell upgrades (every page)
- Logo / "Gharpayy Arena" wordmark.
- Global search (mocked — Ctrl+K opens a command palette: people, tasks, leads, calendar events).
- Notification bell with live count.
- Calendar quick-peek button.
- "Acting as" role + identity selector (already exists, keep).
- Avatar → quick links to Profile, Score, Settings.

### 15. Sound + micro-interactions
- Subtle "ding" on new toast notification (toggleable in settings).
- Confetti burst when kudos received.
- Status dot pulses when teammate goes live.
- Smooth page transitions.

---

## The "feels acknowledged & worthy" layer (cross-cutting)

These aren't features — they're tone choices applied everywhere:

- **Names everywhere, never IDs.** "Riya just clocked in" not "Employee #4 status changed."
- **Verbs, not nouns.** Buttons say "Cheer Riya on" not "Send Notification."
- **Streaks, milestones, named tiers** ("Arena Champion", "Field Hero") instead of percentages alone.
- **"Why this matters" microcopy** on every metric — so people feel the score, not just see it.
- **Empty states are warm**, not boring ("No tasks today — go help a teammate or take a breath").
- **Coach speaks like a coach**, not a bot ("Big day yesterday — let's keep the streak alive").

---

## Build order (what ships in this turn vs. follow-up)

**This turn — the connected core (single big delivery):**

1. App shell upgrade: top bar with bell + calendar peek + global search + role switcher.
2. Notification system (store + bell + toast + `/inbox`).
3. Unified Calendar `/calendar` with all event types from seed.
4. Arena Home `/` (replaces current landing) — role-aware Today's Mission + pulse + squad + coach nudge + calendar peek + kudos feed.
5. People directory `/people` with profile drawer.
6. Tasks Kanban `/tasks` with auto-task generation hooks.
7. Leaves `/leaves` with approval flow + auto-notifications.
8. Kudos `/kudos` feed + give-kudos modal anywhere.
9. Score card `/score` with tier band + trend.
10. War Room `/war-room` upgrade (live tiles + ticker + leaderboard).
11. Coach `/command` upgraded with role-aware prompt chips.
12. Email digest preview `/inbox/digests`.
13. Settings `/settings` with notification prefs + calendar sync mock.
14. Seed data expanded: kudos, tasks, leaves, calendar events, notifications, anomalies — populated for all 9 mock identities so every screen feels alive.

**Deferred (call out, don't build yet):**
- Real Google Calendar / email sending (currently mocked UI with realistic preview).
- Real-time websockets (we simulate with intervals on seed data).
- Backend persistence (still localStorage; same shape, easy to swap).

---

## Technical notes (for reference)

- All routes are TanStack Start file routes under `src/routes/`. Each gets its own `head()` metadata.
- Single Zustand-style stores in `src/lib/`: `notification-store.ts`, `calendar-store.ts`, `kudos-store.ts`, `task-store.ts`, `leave-store.ts`, `score-engine.ts`. Existing `attendance-store.ts` stays.
- Auto-task / auto-notification generation runs on store mutations via subscribers (mocks the event bus from your playbook).
- Coach AI continues to use Lovable AI Gateway via the existing `core-ai` edge function — no API key needed.
- Seed data extended in `src/data/seed.ts` to cover kudos, tasks (with handoff chains), leaves, calendar events, notifications.
- Light sounds via Web Audio API (no external assets), confetti via `canvas-confetti` (small dep).
- No auth — `AppShell` "Acting as" continues to drive role context everywhere.

---

## What you'll feel when it's live

Open it as **Riya (Sales Agent)** → see her 3 missions today, a coach nudge to follow up on 2 hot leads, a kudos she got yesterday from her Lead, and her tour at 4pm on the calendar peek. Click bell → 5 unread, including a leave approval and a teammate's birthday tomorrow.

Switch to **Aman (HR)** → war room view, 2 attendance anomalies in the inbox, a digest preview ready to send at 6pm, leaderboard of the week, and a coach suggestion: "Anika has a 30-day perfect streak — give her a kudo?"

Switch to **Admin** → everything above, plus settings, plus the AI command center loaded with executive prompts.

That's the Arena.
