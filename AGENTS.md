# AGENTS.md

## Project Overview

**Name:** Sentinel MR (working title — see naming discussion)
**What it is:** A Next.js dashboard for an AI Code Review Agent. The agent runs locally and connects to GitLab through a NestJS-based MCP (Model Context Protocol) server over stdio. The dashboard lets a human reviewer see AI-flagged findings on open merge requests, review compliance rules pulled from a bank's internal rulebook, and approve, edit, or dismiss the AI's review comments before they're pushed back to GitLab.

**Domain:** Secure banking / FinTech internal tooling. Every design and copy decision should read as "internal compliance tool," not consumer SaaS.

**Primary user:** A human code reviewer (engineer or security/compliance staff) who needs a fast way to triage AI findings without reading raw GitLab MR pages.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Component library | shadcn/ui |
| Icons | lucide-react |
| State | React `useState` only — no external state library, no server state library (yet) |
| Backend (not in this repo) | NestJS MCP Server, communicates with GitLab API, exposes tools/resources over stdio MCP transport |

No data fetching library (SWR/React Query) is wired up yet — all data is mocked client-side. See "Next Steps" below for what's needed to go live.

---

## File Structure (current)

```
/
├── code-review-dashboard.tsx   # Canonical TypeScript version (strict types, for copy-paste into a real Next.js project)
├── code-review-dashboard.jsx   # Plain-JS/JSX version (no TS syntax) — used for live preview rendering where a TS transpile step isn't available
└── AGENTS.md                   # This file
```

In a real project, this single file should eventually be split into:

```
app/
  (dashboard)/
    page.tsx                    # imports <CodeReviewDashboard />
components/
  code-review/
    mcp-status-bar.tsx
    mr-sidebar.tsx
    mr-card.tsx
    diff-viewer.tsx
    rulebook-checklist.tsx
    action-panel.tsx
    status-badge.tsx
    types.ts                    # MergeRequestSummary, DiffRow, RuleCheck, RiskLevel
    mock-data.ts                # MERGE_REQUESTS, RULEBOOK (delete once live data is wired up)
components/ui/                  # shadcn/ui generated components (do not hand-edit, regenerate via CLI)
```

The component is currently kept single-file by design (per the original build request, for fast copy-paste and artifact preview). Splitting it up is the natural next step once it's pulled into an actual repo.

---

## Setup

```bash
npx create-next-app@latest . --typescript --tailwind --app
npx shadcn@latest init
npx shadcn@latest add card badge tabs scroll-area button alert textarea tooltip
npm install lucide-react
```

Confirm `tsconfig.json` has the `@/*` path alias pointing at the project root — `create-next-app` sets this up automatically when you accept the default import-alias prompt.

Fonts (`font-sans` / `font-mono`) are NOT pre-configured — see the "Fonts" section below before shipping.

---

## Design System / Tokens

**Palette (Secure Banking FinTech theme):**
- Canvas: `slate-950`
- Panels / surfaces: `zinc-900`, `zinc-950`, borders `zinc-800` / `zinc-700`
- Text: `zinc-100` (primary), `zinc-400` / `zinc-500` (secondary), `zinc-600` (tertiary/mono labels)
- Pass / compliant: `emerald-400` / `emerald-500` / `emerald-950` backgrounds
- Critical / blocking: `rose-400` / `rose-500` / `rose-950` backgrounds
- Pending / warning: `amber-400`

**Typography:**
- `font-sans` — UI chrome (headers, labels, buttons, card titles)
- `font-mono` — anything identifier-like or code-like: MR IDs, rule IDs, file paths, diff content, branch names. This is a deliberate signature choice reinforcing the "terminal / security tool" feel — don't drop mono styling from IDs even if it seems like a small detail.

**Signature interaction patterns (do not remove without reason):**
1. **Inline annotation threads** — the destructive `Alert` for a flagged diff line renders directly under that line (with a small vertical connector), not detached at the bottom of the diff. This mirrors GitLab's own inline MR discussion UX and is the single most important visual idiom in the diff viewer. If adding new finding types, keep this pattern.
2. **Pulsing connection indicator** — the emerald ping-dot next to "Connected via stdio" with a tooltip explaining "Local stdio transport — no network egress." This is a trust signal specific to a bank's security posture (no data leaving the local machine) and should be preserved even if the MCP transport details change — just update the tooltip copy to match the real transport.
3. **Persistent Action Panel** — sits as a sibling to the `Tabs`, not inside a `TabsContent`, so the reviewer's draft comment and dismiss/push actions stay visible regardless of which tab (Diff / Rulebook) is active. Do not move this panel inside a tab.

---

## Data Shapes (current mock types)

```ts
type RiskLevel = "critical" | "passed";

interface DiffRow {
  line: number;
  code: string;
  kind: "context" | "added" | "removed" | "flagged";
}

interface RuleCheck {
  id: string;
  label: string;
  status: "pass" | "fail" | "pending";
}

interface MergeRequestSummary {
  id: string;
  title: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  filesChanged: number;
  status: RiskLevel;
  diffFile: string;
  diff: DiffRow[];
  findingRuleId?: string;
  findingTitle?: string;
  findingLine?: number;
  aiComment: string;
}
```

**Known simplification:** `RiskLevel` only supports `"critical" | "passed"` to match the two badge labels in the original spec ("Critical Vulnerability" / "Conventions Passed"). A real implementation will likely need a third state like `"warning"` or `"needs-review"` for MRs with non-blocking findings — extend `RiskLevel` and `STATUS_STYLES` together if so, and confirm new badge copy with design/product before adding.

**Known limitation:** Each `MergeRequestSummary` supports at most one `findingRuleId` (single flagged line). Real MRs can have multiple findings across multiple files. Don't extend this ad hoc — it needs a proper redesign (`findings: Finding[]` array, findings keyed to specific diff rows, possibly multiple files per MR) before going live. Flag this explicitly to whoever picks up the backend integration.

---

## Wiring to the Real Backend (next steps, not yet implemented)

1. **Replace mock data with MCP calls.** The NestJS MCP Server should expose:
   - A tool/resource to list open MRs with their AI risk status → replaces `MERGE_REQUESTS`
   - A resource at something like `resource://bank-rulebook/v3.json` → replaces `RULEBOOK` (the UI already references this URI in the Rulebook tab tooltip — keep it in sync with whatever the real resource URI ends up being)
   - A tool to fetch full diff + findings for a given MR id
   - A tool to push an (edited) AI comment back to GitLab on a specific MR/line
   - A tool to mark a finding as dismissed/false-positive (and ideally persist that so it doesn't resurface on next scan)

2. **Replace `setTimeout`-simulated states** (`isPosting`, `isSyncing`) with real async calls to the above tools, including error states — there is currently no error handling/UI for a failed push or failed sync. This needs to be designed (toast? inline error in the Action Panel?) before going live.

3. **Multiple findings per MR** — see limitation above.

4. **Auth** — there is no auth/session concept in this component at all. Decide whether the dashboard sits behind existing SSO before exposing it beyond local dev.

---

## Fonts

`font-sans` and `font-mono` currently resolve to generic system stacks. For production, load real fonts via `next/font/google` in the root layout and map them to CSS variables consumed by `tailwind.config.ts`. See chat history / prior guidance for the exact `Inter` + `JetBrains Mono` setup — do this before shipping, since the mono treatment on IDs/diffs is a core part of the visual identity and looks noticeably different on system fallback fonts vs. JetBrains Mono.

---

## Conventions for Agents Editing This Project

- Keep the dark **Secure Banking FinTech** palette — don't introduce gradients, bright accent colors outside emerald/rose/amber, or playful illustration. This is an internal compliance tool, not a marketing site.
- Don't add numbered-step markers (01/02/03) or other generic "AI dashboard" decoration unless the content is a genuine sequence.
- Any new finding/alert UI must follow the inline-thread pattern (rendered next to the relevant diff line), not a detached banner, unless there's a strong reason to deviate — note that reason in this file if you do.
- Mono font for all IDs, rule codes, file paths, branch names, and diff content. Sans font for everything else.
- Keep the Action Panel persistent across tabs.
- When extending mock data, keep it minimal (the original spec intentionally limited to 2 MRs / short diffs / 5 rulebook items to keep the file fast to generate and read) — don't bulk up mock arrays unless testing a real scenario that needs more data.
- This file (`AGENTS.md`) should be updated whenever a "known limitation" above gets resolved, or whenever a new signature design pattern is introduced.