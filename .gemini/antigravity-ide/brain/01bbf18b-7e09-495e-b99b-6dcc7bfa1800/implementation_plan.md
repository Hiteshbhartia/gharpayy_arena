# Global Responsive Audit & Hardening

**Goal**: Eliminate horizontal overflow on all routes and shared UI components across mobile viewports (375 px, 390 px, 414 px, 430 px) while preserving desktop layout and functionality.

## User Review Required
- Approve the automated audit approach using a headless Chromium script.
- Approve the bulk‑apply of Tailwind utility fixes based on audit results.

> [!IMPORTANT] 
> The script will run `npm run dev` (already running) and open each route in a headless browser. No code logic will be altered by the script itself.

## Open Questions
1. **Timeout per route** – Recommended 15 s page load + 5 s after Clock In interaction. Is that acceptable?
2. **Screenshots storage** – Continue using `artifacts/screenshots/` in the conversation workspace?
3. **Commit style** – Use a single commit per file or a consolidated commit? (We propose one commit per file for clarity.)

## Proposed Changes
### 1. Add audit script
- **File**: `src/scripts/responsive-audit.ts`
- Implements headless Chromium (Puppeteer) to:
  - Start dev server if not running.
  - Visit each prioritized route (Live Roster, Operator Console, KPI Governance, Workforce, Attendance) and then all other routes.
  - For each viewport width (375, 390, 414, 430) capture:
    - `document.documentElement.scrollWidth <= window.innerWidth`
    - List of elements where `el.scrollWidth > el.clientWidth`.
  - Save a JSON report (`artifacts/audit_report.json`) and screenshots (`artifacts/screenshots/<route>_<width>.png`).

### 2. Apply responsive fixes (bulk)
- Scan the audit report for offending CSS utilities.
- For each offending file, insert Tailwind classes:
  - `min-w-0` on flex/grid containers.
  - `max-w-full` on cards, tables, dialogs.
  - Replace fixed pixel widths with responsive equivalents (`w-full`, `sm:w-[...]`).
  - Add `overflow-x-auto` only to intentionally scrollable tables.
  - Ensure `whitespace-normal` or `break-words` for long text.
- Files to be edited will include route pages (`src/routes/**/*.tsx`) and shared UI components (`src/components/**/*.tsx`).

### 3. Verification
- Re‑run the audit script after fixes.
- Ensure `overflow` flag is `false` for every route/viewport.
- Capture final screenshots for proof.

## Verification Plan
### Automated Tests
- Run `npm run dev` (already running).
- Execute `node src/scripts/responsive-audit.ts`.
- Assert that the JSON report contains no overflow entries.

### Manual Verification
- Open a few routes in Chrome dev tools mobile view to visually confirm no horizontal scroll.

---
**Commit Message**: `fix(ui): eliminate horizontal overflow and improve responsiveness across application`
