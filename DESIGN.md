# LinkedIn Growth Copilot — UI/UX Design System & Specification

Version 1.0 · Companion to PRD/TRD v1.1
Stack: React + JavaScript + Vite · Tailwind CSS · shadcn/ui (primary) · Aceternity UI (accent moments only) · React Router · Lucide icons

---

## 0. How to read this document

This is the single source of truth for how the product looks, feels, and behaves. Every screen maps to a PRD feature (F01–F13). Every decision has a reason: a UX law, a psychological principle, or a trust requirement from the PRD (especially BYOK).

**The design thesis in one sentence:**
> *A calm, editorial writing studio that feels like a trusted editor sitting next to you, not a chatbot that dumps text at you.*

---

## 1. Design philosophy

### 1.1 Who we're designing for
Founders, indie hackers, developers, AI engineers, freelancers. They are **busy, skeptical of generic AI output, technically literate, and allergic to hype.** They already know what ChatGPT-style slop looks like. So the product must feel:

- **Crafted**, not generated: considered typography, restrained color, real hierarchy.
- **Honest**: scores are "advisory", similarity is "a heuristic". The UI never overpromises.
- **Fast to value**: first draft within ~2 minutes of signing up.
- **Writer-first**: the draft is the hero. Everything else supports it.

### 1.2 Five principles

| # | Principle | What it means in practice |
|---|-----------|---------------------------|
| 1 | **The draft is the hero** | Editor gets the largest area, the best typography, the most whitespace. Tools orbit it. |
| 2 | **Show your sources** | Every AI output shows what it was grounded in (RAG chunks, source claims). Trust through transparency. |
| 3 | **Human in the loop, always** | Nothing auto-publishes. Approve/Reject/Edit are first-class, never buried. |
| 4 | **Calm density** | Information-rich but never noisy. One primary action per view. |
| 5 | **Earned delight** | Motion and flourish appear at moments of achievement (first draft, approval, scheduled), not everywhere. |

### 1.3 How we avoid the "AI-generated look"
These are explicit **bans**. If a PR violates one, it gets rejected.

| Banned (the AI-template tells) | Do instead |
|---|---|
| Purple→blue gradient everywhere | Warm neutral paper + one confident accent (Ember) |
| Sparkle ✨ emoji/icons on every AI action | A small custom "pen-nib" glyph used sparingly; text labels like "Draft" and "Refine" |
| Glassmorphism cards on gradient blobs | Flat surfaces, hairline borders, subtle paper grain |
| Centered hero with floating 3D blobs | Left-aligned editorial hero with a real product shot |
| Inter-only, all-bold, all-same-size text | Serif display + sans UI + mono for data; deliberate scale |
| Rounded-2xl everything, same shadow everywhere | Mixed radii by component role; shadows only for floating layers |
| "Supercharge / Unlock / Revolutionize" copy | Plain, specific, slightly dry voice (see §12) |
| Emoji bullet lists in the UI | Lucide icons at 1.5px stroke, used purposefully |
| Perfectly symmetrical 3-column feature grids | Asymmetric bento with varied sizes |
| Skeleton shimmer on everything | Skeletons only where layout is predictable; streaming text elsewhere |

---

## 2. UX laws & psychology — and where each one is applied

| Law / Concept | Application in this product |
|---|---|
| **Hick's Law** (fewer choices = faster decisions) | Generation form shows 3 essentials up front (Source, Format, Goal). Tone, length, CTA live in a collapsed "Fine-tune" panel. |
| **Fitts's Law** | Primary CTA ("Generate draft") is large, bottom-right of the form, always in thumb/cursor reach. Mobile: sticky bottom bar. |
| **Miller's Law** (7±2) | Sidebar max 7 items. Planner shows max 5 post slots per week view by default. |
| **Jakob's Law** (users expect familiar patterns) | Sidebar nav, command palette (⌘K), Notion/Linear-style editor, Google-Calendar-style calendar. |
| **Law of Proximity & Common Region** | Hook / Body / CTA / Hashtags grouped in one "paper" card; evaluation scores in a separate side panel. |
| **Law of Prägnanz** | Score visuals reduce to simple rings and bars, not radar charts. |
| **Von Restorff (isolation) effect** | Only one Ember-colored element per view → the primary action. Warnings use a distinct amber, errors a distinct red. |
| **Serial position effect** | Most important nav items first (Studio) and last (Settings/Key status). Hook is first thing in draft, CTA last. |
| **Peak-End Rule** | Peak: first generated draft reveal (streamed, with grounded-source chips). End: "Approved & scheduled" confirmation with a quiet success moment. |
| **Zeigarnik effect** | Onboarding checklist shows progress (3 of 5 done); unfinished drafts show "Continue editing" on dashboard. |
| **Goal-gradient effect** | Onboarding progress bar accelerates visually as the user nears completion. Weekly streak ring fills toward goal. |
| **Endowed progress** | New accounts start with "Account created ✓" already ticked in the checklist. |
| **IKEA effect / Endowment** | Users edit and approve drafts → they feel ownership. Brand Voice is built by the user, which raises switching cost ethically. |
| **Variable reward (ethical use)** | Each generation offers 3 angle options. Quality score reveals progress between revisions. No dark patterns, no manipulative streak shaming. |
| **Aesthetic-Usability effect** | The editorial polish makes users forgive latency and perceive higher quality. |
| **Doherty Threshold (<400 ms)** | Optimistic UI for save/approve; streaming for generation; instant client-side validation. |
| **Cognitive load theory** | Progressive disclosure: advanced settings, raw scores, similarity details expand on demand. |
| **Tesler's Law** (complexity must live somewhere) | BYOK complexity is absorbed by a guided, 3-step key connection panel with plain-language trust copy. |
| **Postel's Law** | Accept pasted text messily (transcripts with timestamps, markdown, raw HTML) and clean it up for the user. |
| **Choice overload / defaults** | Smart defaults from Brand Profile pre-fill tone, audience, and CTA. |
| **Social proof (honest only)** | No fake stats. Show the user's own history: "You've approved 12 posts this month." |
| **Loss aversion (gentle)** | Unsaved-changes guard, version history to undo. We never use fear to retain. |
| **Trust signals** | Persistent key-status pill, "key stays in memory" copy, visible source citations. |

---

## 3. Brand & visual identity

### 3.1 Personality
**Editorial · Focused · Quietly confident · Slightly witty.** Think *Linear meets a well-typeset magazine.* A newsroom's calm, not a startup's confetti.

### 3.2 Color system

Warm, paper-like neutrals + ink text + one accent. Defined as CSS variables (shadcn convention) so light/dark theming works.

#### Light theme
| Token | Hex | Usage |
|---|---|---|
| `--paper` (background) | `#FAF8F4` | App background |
| `--surface` (card) | `#FFFFFF` | Cards, editor sheet |
| `--surface-2` | `#F3F0E9` | Sidebar, input fills, muted areas |
| `--line` (border) | `#E7E2D8` | Hairline borders |
| `--ink` (foreground) | `#16130F` | Primary text |
| `--ink-2` | `#4A453D` | Secondary text |
| `--ink-3` | `#857F73` | Tertiary text, placeholders |
| `--ember` (primary) | `#E5532D` | Primary action, key highlights. **One per view.** |
| `--ember-hover` | `#CF4522` | Hover/pressed |
| `--ember-soft` | `#FCE9E2` | Ember tint backgrounds |
| `--moss` (success/grounded) | `#2F6B57` | Approved, grounded sources, good scores |
| `--moss-soft` | `#E3F0EB` | Success tint |
| `--amber` (warning) | `#B7791F` | Repetition warnings, unsupported claims |
| `--amber-soft` | `#FBF0D9` | Warning tint |
| `--rose` (destructive) | `#B3261E` | Errors, delete |
| `--rose-soft` | `#FBE7E5` | Error tint |
| `--sky` (info) | `#2B5C8A` | Info, links, scheduled state |
| `--sky-soft` | `#E4EEF7` | Info tint |

#### Dark theme (warm, not pure black)
| Token | Hex |
|---|---|
| `--paper` | `#0F0E0C` |
| `--surface` | `#17150F` |
| `--surface-2` | `#1F1C16` |
| `--line` | `#2C2820` |
| `--ink` | `#F4F0E8` |
| `--ink-2` | `#B9B2A4` |
| `--ink-3` | `#7C7669` |
| `--ember` | `#F0663F` |
| `--moss` | `#5BB394` |
| `--amber` | `#E0A94A` |
| `--rose` | `#F0776F` |
| `--sky` | `#6FA3D6` |

**Contrast rules:** all text ≥ 4.5:1 (AA); large text and UI icons ≥ 3:1. Never use `--ink-3` for essential text.

**Semantic color mapping (consistent everywhere)**
- Ember = primary action / "do this next"
- Moss = grounded, approved, strong
- Amber = needs your attention (not an error)
- Rose = error / destructive
- Sky = scheduled / informational

### 3.3 Typography

| Role | Font | Weights | Notes |
|---|---|---|---|
| Display / headings / hook text in editor | **Fraunces** (variable serif, "soft" optical) | 400, 600 | Gives the editorial, crafted feel. Use `opsz` axis. |
| UI / body | **Geist Sans** (fallback Inter Tight) | 400, 500, 600 | Crisp, modern, great at small sizes. |
| Data / scores / job IDs / similarity % | **JetBrains Mono** (or Geist Mono) | 400, 500 | Signals precision and "this is a measurement". |

**Type scale (desktop / mobile)**

| Token | Size / line-height | Use |
|---|---|---|
| `display` | 48/52 → 34/38 | Landing hero, empty-state hero |
| `h1` | 32/38 → 26/32 | Page titles (Fraunces 600) |
| `h2` | 24/30 → 20/26 | Section titles (Fraunces 600) |
| `h3` | 18/26 | Card titles (Geist 600) |
| `body` | 15/24 | Default UI text |
| `body-lg` | 17/28 | Draft body in editor (Fraunces 400 for the "reading" feel) or Geist for UI-consistent |
| `small` | 13/20 | Meta, helper text |
| `micro` | 11/16, letter-spacing +0.04em, uppercase | Labels, eyebrow tags |

**Rules**
- Max line length for draft text: **62–68 characters** (readability).
- Use **tabular-nums** for all numbers in analytics and scores.
- Draft preview matches LinkedIn's actual reading context: 15px Geist, 1.45 line-height, in a "post preview" card.

### 3.4 Spacing, radius, elevation

- **Spacing scale:** Tailwind default 4px base. Use 4/8/12/16/24/32/48/64. Layout rhythm = 8pt grid.
- **Radius by role** (not uniform):
  - Inputs, buttons: `8px` (`rounded-lg`)
  - Cards: `14px` (`rounded-[14px]`)
  - Editor sheet: `18px`
  - Pills/chips/badges: `9999px`
  - Modals/popovers: `16px`
- **Elevation:** Flat by default. Hairline `1px` border `--line`. Shadows *only* for floating layers:
  - `shadow-pop`: `0 8px 24px -8px rgb(22 19 15 / 0.18), 0 2px 6px rgb(22 19 15 / 0.06)` (popovers, dropdowns, command palette)
  - `shadow-lift`: `0 1px 0 rgb(255 255 255 / .6) inset, 0 1px 2px rgb(22 19 15 / .06)` (primary button)
- **Texture:** 2–3% opacity paper-grain noise on `--paper` background (SVG data-URI). Subtle; removable for performance.

### 3.5 Iconography
- **Lucide** icons, stroke `1.5`, size 16/18/20.
- No filled icon style mixing.
- One custom brand glyph: a stylized **pen-nib / cursor-caret** (logo + AI action marker). Used on "Generate", loading states, and empty states only.

### 3.6 Logo & wordmark
Wordmark "**Growth Copilot**" in Fraunces 600, with a small ember caret `|` after it that blinks once on load (typing metaphor). Favicon: ember caret on paper.

---

## 4. Tailwind configuration

```js
// tailwind.config.js
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        paper: "hsl(var(--paper))",
        surface: { DEFAULT: "hsl(var(--surface))", 2: "hsl(var(--surface-2))" },
        line: "hsl(var(--line))",
        ink: { DEFAULT: "hsl(var(--ink))", 2: "hsl(var(--ink-2))", 3: "hsl(var(--ink-3))" },
        ember: { DEFAULT: "hsl(var(--ember))", hover: "hsl(var(--ember-hover))", soft: "hsl(var(--ember-soft))" },
        moss:  { DEFAULT: "hsl(var(--moss))",  soft: "hsl(var(--moss-soft))" },
        amber: { DEFAULT: "hsl(var(--amber))", soft: "hsl(var(--amber-soft))" },
        rose:  { DEFAULT: "hsl(var(--rose))",  soft: "hsl(var(--rose-soft))" },
        sky:   { DEFAULT: "hsl(var(--sky))",   soft: "hsl(var(--sky-soft))" },
        // shadcn compatibility aliases
        background: "hsl(var(--paper))",
        foreground: "hsl(var(--ink))",
        primary: { DEFAULT: "hsl(var(--ember))", foreground: "#fff" },
        muted: { DEFAULT: "hsl(var(--surface-2))", foreground: "hsl(var(--ink-3))" },
        border: "hsl(var(--line))",
        ring: "hsl(var(--ember))",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Geist", "Inter Tight", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: { card: "14px", sheet: "18px" },
      boxShadow: {
        pop: "0 8px 24px -8px rgb(22 19 15 / .18), 0 2px 6px rgb(22 19 15 / .06)",
        lift: "0 1px 0 rgb(255 255 255 / .6) inset, 0 1px 2px rgb(22 19 15 / .06)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out-soft": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        "fade-up": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } },
        caret: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0 } },
        "ring-fill": { from: { strokeDashoffset: "var(--ring-from)" }, to: { strokeDashoffset: "var(--ring-to)" } },
      },
      animation: {
        "fade-up": "fade-up .35s var(--ease-out-expo, cubic-bezier(.16,1,.3,1)) both",
        caret: "caret 1s steps(1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
```

```css
/* index.css — tokens in HSL triplets so shadcn opacity utilities work */
:root {
  --paper: 40 33% 97%;   --surface: 0 0% 100%;  --surface-2: 42 27% 93%;
  --line: 42 22% 87%;
  --ink: 30 20% 8%;      --ink-2: 38 10% 27%;   --ink-3: 40 7% 49%;
  --ember: 12 78% 52%;   --ember-hover: 12 74% 45%; --ember-soft: 14 85% 93%;
  --moss: 160 40% 31%;   --moss-soft: 158 33% 91%;
  --amber: 38 71% 42%;   --amber-soft: 41 82% 91%;
  --rose: 3 71% 41%;     --rose-soft: 4 70% 94%;
  --sky: 208 53% 35%;    --sky-soft: 208 55% 93%;
}
.dark {
  --paper: 40 14% 5%;    --surface: 42 22% 8%;  --surface-2: 42 20% 11%;
  --line: 40 18% 15%;
  --ink: 40 33% 94%;     --ink-2: 40 14% 68%;   --ink-3: 40 8% 44%;
  --ember: 13 85% 57%;   --moss: 160 33% 56%;
  --amber: 38 69% 58%;   --rose: 3 80% 69%;     --sky: 208 56% 60%;
}
body { font-family: theme(fontFamily.sans); background: hsl(var(--paper)); color: hsl(var(--ink)); font-feature-settings: "ss01","cv11"; }
.num { font-variant-numeric: tabular-nums; font-family: theme(fontFamily.mono); }
```

---

## 5. Component library strategy

### 5.1 shadcn/ui (primary — ~90% of UI)
Use for all structural and interactive primitives, restyled with our tokens:

`Button, Input, Textarea, Label, Select, Combobox (Command + Popover), Tabs, Dialog, Sheet, Drawer, Popover, Tooltip, DropdownMenu, Command (⌘K), Calendar, Badge, Card, Separator, ScrollArea, Skeleton, Progress, Switch, Checkbox, RadioGroup, Slider, Accordion, Collapsible, Table, Toast (Sonner), AlertDialog, Form (react-hook-form), Avatar, Breadcrumb, ResizablePanel`

**Restyle rules for shadcn defaults** (this is what removes the "default shadcn look"):
1. Replace neutral grays with the warm tokens above.
2. Increase button height to 40px (default) / 48px (hero), medium weight, `rounded-lg`.
3. Use 1px `--line` borders with an inner highlight on primary buttons (`shadow-lift`).
4. Focus ring: 2px `--ember` at 40% with 2px offset (visible, branded).
5. Inputs: `--surface-2` fill → `--surface` on focus with ember ring. No heavy shadows.
6. Badge variants: `grounded` (moss), `warning` (amber), `scheduled` (sky), `draft` (neutral), `approved` (moss solid), `rejected` (rose soft).

### 5.2 Aceternity UI (accent only — max ~10%)
Use **sparingly** for a few signature moments, always tuned to our palette and always respecting `prefers-reduced-motion`:

| Aceternity component | Where | Why |
|---|---|---|
| **Text Generate Effect** | Streaming reveal of generated hook/body in the editor | Makes generation feel alive; supports the peak moment |
| **Bento Grid** | Landing page feature section + dashboard overview | Asymmetric layout, avoids symmetrical-card look |
| **Animated Tooltip / Hover Card** | Source-chip previews (RAG citation) | Delightful but functional |
| **Spotlight (very subtle, 6% opacity)** | Landing hero background only | Depth without gradient blobs |
| **Tracing Beam** | Landing "how it works" vertical story | Narrative scroll |
| **Moving Border (1px ember)** | Only on the *Generate* button while loading | Clear busy state |
| **Sticky Scroll Reveal** | Landing: Source → Draft → Evaluate → Schedule | Storytelling |
| **Number Ticker** | Analytics totals | Satisfying, small |

**Do NOT use Aceternity for:** forms, tables, nav, editor chrome, settings, error states, anything in the critical path. Motion in the core app must never slow a task.

### 5.3 Custom components to build
`KeyStatusPill, SourceChip, ScoreRing, ScoreBar, CriterionRow, SimilarityCard, DiffViewer, LinkedInPreview, PostEditor, AngleCard, PlanWeekBoard, JobStatusBadge, OnboardingChecklist, EmptyState, TrustNote, TimezoneChip`

---

## 6. Layout & navigation

### 6.1 App shell (desktop ≥1024px)

```
┌──────────────┬─────────────────────────────────────────────────┐
│ Sidebar 232px│  Topbar (56px): breadcrumb · ⌘K · KeyStatusPill │
│              ├─────────────────────────────────────────────────┤
│ ▪ Studio     │                                                 │
│ ▪ Library    │              Page content                       │
│ ▪ Knowledge  │         (max-w 1200, 24–32px padding)           │
│ ▪ Planner    │                                                 │
│ ▪ Calendar   │                                                 │
│ ▪ Analytics  │                                                 │
│ ──────────── │                                                 │
│ Brand Voice  │                                                 │
│ Settings     │                                                 │
│ [avatar]     │                                                 │
└──────────────┴─────────────────────────────────────────────────┘
```

- **Sidebar:** `--surface-2` background, 7 primary items + 2 footer items (Miller's Law). Active item: ink text, 2px ember left indicator, `--surface` pill background.
- **Collapsible** to a 64px icon rail (remembers preference in localStorage — this is a UI preference only, **never the key**).
- **Topbar:** breadcrumb, global **⌘K command palette** (jump anywhere, "New draft", "Search knowledge"), **KeyStatusPill**, theme toggle.
- **Tablet (640–1023px):** icon rail by default, content full width.
- **Mobile (<640px):** bottom tab bar (Studio, Library, Planner, Calendar, More). Primary action as a floating "+" above the bar.

### 6.2 Information architecture

```
/                       Landing (public)
/login  /register       Auth
/app                    → redirects to /app/studio
/app/onboarding         First-run checklist (also a dashboard widget)
/app/studio             Content Studio (generate)
/app/studio/:id         Draft editor + evaluation + similarity
/app/library            All drafts (filter: draft/approved/rejected/scheduled)
/app/knowledge          Knowledge base (notes, approved posts, guidelines)
/app/voice              Brand voice
/app/planner            Weekly plans
/app/calendar           Calendar & jobs
/app/analytics          Metrics
/app/settings           Account, timezone, OpenRouter key, data & privacy
```

### 6.3 Page grid
12-column grid, 24px gutters desktop, 16px mobile. Editor page uses a 3-pane layout (see §8.4).

---

## 7. Critical flows

### 7.1 First-run (the most important 3 minutes)

Goal: **time-to-first-draft < 3 min, drop-off minimal.**

```
Register → Welcome (1 screen) → Connect key (guided) → Brand voice quick-start (3 fields) 
        → First generation (pre-filled sample source) → Reveal draft (peak moment) → Checklist
```

- **Welcome:** one headline, one sentence, one button. No tour carousel.
- **Onboarding checklist** (persistent card on Studio until done, dismissible):
  1. ✓ Account created *(endowed progress)*
  2. Connect your OpenRouter key
  3. Define your voice (3 quick fields)
  4. Generate your first draft
  5. Approve it & schedule it
- Progress bar with goal-gradient easing. Each completion triggers a small tick animation, not confetti.
- **Skippable but reversible**: skipping never blocks the app; features needing a key show an inline "Connect key" prompt instead of an error.

### 7.2 Core loop
```
Add source / idea → Choose angle → Generate → Edit → Evaluate → Check repetition 
→ Approve → Schedule → (later) Record metrics
```
Every step has exactly one obvious next action (ember button).

### 7.3 BYOK connection flow (F02) — trust is the design
See §8.1 for the full spec. Summary: guided 3-step panel, plain-language security copy, immediate validation, persistent status pill, and graceful "key lost on refresh" recovery.

---

## 8. Screen-by-screen specification

### 8.1 Settings → OpenRouter key (F02, §12 of TRD)

This screen carries the product's trust. Treat it like a bank's security page: calm, clear, never scary.

**Layout:** two-column. Left: connection card. Right: "How we handle your key" trust panel.

**Connection card states**

| State | UI |
|---|---|
| **Disconnected** | Input (password type, monospace, paste-optimized) + "Connect" (ember). Helper link: "Get a key from OpenRouter ↗" |
| **Validating** | Button becomes spinner + "Checking key…" (≤ 4 s typical). Input disabled. |
| **Connected** | Masked key `sk-or-••••••••k3f9` in a read-only field, green `KeyStatusPill` "Connected", model selector, "Replace" and "Disconnect" ghost buttons. |
| **Invalid** | Inline rose message: "That key wasn't accepted by OpenRouter. Check it for typos or create a new one." Never echoes the raw key or provider error. |
| **Rate-limited / provider down** | Amber inline message with retry. |
| **Session lost (after refresh)** | Topbar pill turns amber "Reconnect key"; a non-blocking banner explains: "For your security, your key lives only in this tab's memory. Paste it again to continue." Drafts are never lost. |

**Model selector:** `Combobox` with name, short descriptor, relative cost hint (¢ / ¢¢ / ¢¢¢), and a "Recommended" badge. Disabled models explain why ("Doesn't support embeddings").

**Trust panel (right) — plain, specific copy, with icons**
- "Your key stays in this browser tab's memory. We never save it to our database."
- "We send it over HTTPS only to OpenRouter, only when you run an action."
- "Closing or refreshing the tab clears it."
- "You're trusting this app with your credential. Monitor usage in your OpenRouter dashboard and set a spend limit there." + link.

**Microinteractions:** On successful connect, the input collapses into the masked row with a 250 ms height transition and a single moss tick. No confetti.

**KeyStatusPill (topbar, always visible)**
- Green dot + "Connected · {model}" → click opens popover (switch model / disconnect).
- Amber dot + "Reconnect" → opens settings sheet.
- Gray dot + "No key" → opens connect dialog.

### 8.2 Auth (F01)

- **Split layout:** left = form (max-w 400), right = an editorial panel showing a real sample "draft → score → scheduled" vignette (static, designed, not a stock illustration).
- Fields: email, password with show/hide, strength meter (4-segment bar, plain language "Add a longer phrase").
- Social login not in scope; don't fake it.
- Errors inline, specific, non-blaming. Rate-limit lockout message with time remaining.
- **Session expiry (TRD test):** a modal "Your session ended. Log in to continue — your draft is saved locally." Draft content preserved in memory + autosaved server-side where possible.

### 8.3 Content Studio — Generate (F03, F04, F05)

**Purpose:** get from raw material to a first draft with minimum friction.

**Layout (desktop):** Left 60% = input; right 40% = live "Settings & Context" panel.

**Left — Input**
1. **Source selector (segmented control):** Idea · Project notes · Article · Transcript.
2. **Source textarea:** large, auto-grow, min 220 px. Drag-drop `.txt/.md` supported. Character counter bottom-right (mono). Paste cleanup toast: "Removed 14 timestamps from transcript. Undo".
3. **"Extract insights" (secondary button):** runs F04. Shows an **Insights panel** below:
   - Key claims, examples, lessons as selectable cards.
   - Each card tagged **Source** (moss, quoted/paraphrased from your text) vs **Interpretation** (sky, AI inference). Unsupported claims → amber "Needs your check".
   - Select insights → they become the post's focus.
4. **Angle cards (after insights):** 3 horizontally arranged `AngleCard`s (title + one-line hook preview). Choosing one is the key decision (Hick's Law: exactly 3).

**Right — Settings panel**
- **Essentials (always visible):** Format (visual segmented tiles: Story / Educational / Lessons / Technical / Framework / Poll / Carousel), Content goal, Audience (pre-filled from Brand Voice).
- **Fine-tune (accordion, collapsed):** Tone slider-chips, Length (Short/Medium/Long), CTA style, Include hashtags toggle.
- **Context used:** list of RAG chunks that will be fed in, each a `SourceChip` (removable). Header: "Using 3 notes from your knowledge base". Users can deselect or add. This makes retrieval transparent (TRD: "report failures honestly").
- **Voice summary chip:** "Writing as: Direct, practical · For: early-stage founders" → click opens Brand Voice.

**Primary CTA:** "Generate 3 drafts" (ember, 48 px, bottom-right of the form; sticky bottom bar on mobile). Disabled state explains why in a tooltip ("Add some source text first").

**Generating state**
- Button → moving-border ember outline + "Drafting…".
- Right side shows a **step trail** instead of a spinner (reduces perceived wait; honest progress):
  `✓ Loaded your voice → ✓ Found 3 relevant notes → ● Writing drafts → ○ Checking quality → ○ Checking repetition`
- Draft text streams in via Text Generate Effect. User can cancel anytime.

**Result:** Navigates to `/app/studio/:id` with 3 variant tabs ("A / B / C") — peak moment.

**Failure states (F13)** — each has a title, plain cause, and one action:
| Failure | Message | Action |
|---|---|---|
| No key | "Connect your OpenRouter key to generate." | Connect key |
| Invalid key | "OpenRouter rejected your key." | Replace key |
| Rate limit | "OpenRouter is rate-limiting your key. Try again in ~30 s." | Retry (with countdown) |
| Timeout | "That took too long. Your source was kept." | Retry |
| Malformed output | "The model returned something we couldn't use. Trying once more…" then "Couldn't recover. Try a different model." | Switch model |
| Retrieval failed | "We couldn't search your knowledge base, so this draft doesn't use it." (amber, persistent chip) | Retry retrieval |

### 8.4 Draft Editor (F08, F09, F07) — the heart of the app

**Three-pane layout (≥1280 px), resizable via `ResizablePanel`:**

```
┌───────────────┬──────────────────────────────┬─────────────────┐
│ Versions &    │        THE PAPER             │ Review panel    │
│ source (260)  │   (hook / body / CTA / tags) │ (340)           │
│               │   LinkedIn preview toggle    │ Scores · Repeat │
│               │                              │ · Feedback      │
└───────────────┴──────────────────────────────┴─────────────────┘
```
<1280 px: side panes become tabs/sheets. Mobile: full-width editor with a bottom sheet for Review.

**Center — "The Paper"**
- A white `--surface` sheet, 18px radius, soft border, generous padding (48/56 px), max 680 px, centered on `--paper`. Looks like a page you write on, not a form.
- **Structured regions, not one blob** (maps to PRD fields): Hook (Fraunces 24/32, 600), Body (Geist or Fraunces 17/28), CTA (distinct block with left ember hairline), Hashtags (chips, editable).
- Inline "ghost" labels (`HOOK`, `BODY`, `CTA`) in micro type appear on hover/focus, otherwise hidden to keep the paper clean.
- **Selection toolbar** (appears on text select): Tighten · Expand · Make specific · Change tone · Ask to rewrite… Each calls the model and returns an inline suggestion with Accept/Reject (diff highlighted).
- **Character & line counter** (mono, bottom): shows LinkedIn "see more" cutoff as a faint dashed line after ~210 chars of hook (helps writing a compelling first 2 lines — real craft).
- **Autosave:** "Saved · 2 s ago" subtle indicator; optimistic.
- **Preview toggle:** "Edit / LinkedIn preview". Preview renders a faithful but **brand-neutral** mock (avoid copying LinkedIn's exact trademarked UI; use a clean generic feed card with avatar, name, timestamp, text, and collapsed "…see more").
- **Format-specific editors:**
  - *Poll:* question + 2–4 option inputs with live char limits.
  - *Carousel outline:* vertical list of slide cards (slide #, headline, body), drag to reorder.

**Left — Versions & Source**
- Variant tabs (A/B/C) and revision history (timeline).
- **Compare** (F09): select two revisions → `DiffViewer` (word-level, moss insert / rose delete, side-by-side or inline toggle).
- **Source panel:** collapsible source text with **claim highlighting** — hover a sentence in the draft → matching source passage is highlighted (source fidelity made tangible). Unsupported claims underlined with amber dashed line + tooltip "Not found in your source."

**Right — Review panel (Tabs: Quality · Repetition · Feedback)**

*Quality tab (F08)*
- **Overall:** one `ScoreRing` (1–5, mono numeral at center) with the label **"Advisory"** and info tooltip: "Scores help you revise. They don't predict engagement."
- **Six `CriterionRow`s:** Specificity, Clarity, Audience relevance, Structure, Voice match, Source fidelity. Each: label, 5-segment bar (moss/amber/rose by value), one-line explanation. Click to expand → explanation + **"Suggested revision"** with "Apply" button (inline diff preview before applying).
- Lowest score is auto-expanded (guides attention; Hick's Law).
- Re-evaluate button (secondary). Score deltas shown after revision (`+1 Specificity`) → visible progress, goal-gradient.

*Repetition tab (F07)*
- Header: "Similar to 2 earlier posts" (amber if ≥ threshold, neutral otherwise).
- `SimilarityCard`: post title/date, similarity as mono `0.87` + small bar, a **"Why flagged"** line (shared theme/phrases), and actions: "View both" (side-by-side), "Not an issue" (dismiss, remembered), "Revise angle".
- Footnote always visible: "Similarity is a heuristic. It isn't proof of copying."
- Empty: "No close matches found. This looks fresh." (moss, understated.)

*Feedback tab (F09)*
- Thumbs up/down + optional comment. Copy: "Your notes help shape future drafts. This doesn't retrain the model." (honesty per PRD.)

**Sticky action bar (bottom of Paper)**
`Reject` (ghost, rose on hover) · `Save` (secondary) · **`Approve & schedule`** (ember).
- Approve opens the schedule sheet (§8.8) with smart default time.
- Reject opens a tiny popover asking for an optional reason (feeds future generations).
- Keyboard: ⌘S save, ⌘↵ approve, ⌘E evaluate.

### 8.5 Library (drafts list)

- **Table/Board toggle.** Default: dense table (Title, Format, Status badge, Updated, Score, Scheduled).
- **Filters:** status chips, format, date; search box.
- Row hover reveals quick actions (Open, Duplicate, Delete).
- **Bulk select** for delete (AlertDialog confirm with count).
- **Empty state:** illustrated (custom line-art of an open notebook), headline "Nothing drafted yet", CTA "Start from an idea".
- **Status badges:** Draft (neutral), Approved (moss), Rejected (rose-soft), Scheduled (sky), Published (ink).

### 8.6 Knowledge Base (F06)

**Purpose:** make the "memory" tangible so users feel the product knows them.

- **Header:** "What Copilot knows about you" + count of chunks + embedding model tag (mono, e.g. `text-embedding-3-small · v1`).
- **Add knowledge** (primary): dialog with 3 tabs — Project note · Approved post · Brand guideline. Textarea + title + tags. On save → chunk preview ("Split into 4 chunks") then embedding progress.
- **List:** cards showing title, type badge, snippet, chunk count, date. Click → drawer with full text + chunks.
- **Search box (semantic):** results show matched chunk with highlighted relevance bar and the source doc. Toggle "Keyword fallback" with tooltip explaining when it's used.
- **Embedding failure:** per-item amber "Not indexed yet — Retry". Honest, per TRD.
- **Delete:** AlertDialog; explains removal also deletes its embeddings.
- **Hint card (first-time):** "Approved posts are added automatically so your future drafts sound like you." (toggle).

### 8.7 Brand Voice (F05)

Make this feel like *composing a personal style guide*, not filling a form.

- **Two-column:** form left, **live sample** right. The sample paragraph rewrites (cached/pre-generated or generated on demand) as the user changes tone — shows the effect immediately (instant feedback loop → IKEA effect + engagement).
- **Sections (accordion, one open at a time):**
  1. Tone — chip multi-select (Direct, Warm, Witty, Analytical, Humble, Bold) + 3 sliders (Formal↔Casual, Concise↔Detailed, Serious↔Playful).
  2. Audience — free text + suggested chips.
  3. Expertise & content pillars — tag input (max 5; Miller's Law).
  4. Preferred structure — tile choices with tiny wireframe thumbnails (Hook→Story→Lesson→CTA, etc.).
  5. Words to avoid — tag input with red-tinted tags.
  6. Example posts — paste up to N posts; each becomes a card; toggle "Use as style reference".
- **Completeness meter:** "Voice strength: 4/6 sections" (not a vanity score, it tells them what to add).
- Save = autosave with "Saved" indicator.

### 8.8 Planner (F10)

- **Create plan (dialog or inline hero card):** Goal (select), pillars (pre-filled), frequency (1–5/wk stepper), week start, "Use my knowledge & drafts" toggle (default on).
- **Result: `PlanWeekBoard`** — 7-day columns (Mon–Sun) on desktop; vertical day list on mobile. Each suggested post is a card: pillar tag, format icon, working title, angle, suggested time.
- **Everything editable:** inline title edit, drag between days (dnd-kit), delete, "Regenerate this one".
- **Convert to draft** button per card → creates a draft pre-filled in Studio (reduces blank-page anxiety).
- Banner always visible: "Plans never publish automatically." (trust copy.)
- Past plans accessible via a Sheet.

### 8.9 Calendar & Scheduling (F11)

- **Views:** Month (default) / Week / List (mobile default).
- Items are color-coded by status (Draft neutral, Scheduled sky, Published ink, Failed rose).
- **Schedule sheet** (right-side `Sheet`):
  - Date picker + time picker with a visible **TimezoneChip** ("Asia/Kolkata · UTC+05:30") that is editable inline. Subtext: "Stored in UTC, shown in your timezone."
  - "Best times" row only if computed from **the user's own** data; otherwise omit (no fake advice).
  - Validations inline: "Pick a time in the future." / "This time slot already has a post."
  - Button: "Schedule" (ember).
- **Item details popover:** status, `JobStatusBadge` (Queued / Running / Succeeded / Retrying (2/3) / Failed), attempts, next run, sanitized `last_error` (never raw provider data), **Cancel** and **Reschedule**.
- **Job status polling:** quiet 15 s polling with optimistic updates; a small "Worker last seen 12 s ago" indicator in List view (builds trust that scheduling is durable; warns amber if worker silent > threshold).
- **Honesty note:** Until direct LinkedIn publishing is connected, the scheduled job is a **reminder/prepared-post** workflow. UI labels it accurately: "We'll notify you to post" vs "Auto-publish" only when truly available. Never imply auto-posting that doesn't exist.
- **Drag to reschedule** on month/week grid with confirm toast + Undo (8 s).

### 8.10 Analytics (F12)

- Header strip: 4 `Number Ticker` stat tiles (Impressions, Reactions, Comments, Shares) with period toggle (7d / 30d / All).
- Source badge on each metric: **"Manual"** (neutral outline). If an authorized import exists later: **"LinkedIn import"** (moss outline).
- **Chart:** clean line/area (Recharts) with ink line, ember highlight on hover, no gradient fill, light gridlines, mono tick labels.
- **Posts table:** per post metrics, inline "Add metrics" quick-entry (popover with 4 number fields).
- **Comparison:** "vs previous period" delta with arrow + color-blind-safe icons (not color alone).
- **Honesty copy:** "These numbers come from what you enter. They show what happened, not what will."
- **Empty state:** invites entering first metrics with a 20-second inline form.

### 8.11 Settings

Tabs: **Account · Timezone · OpenRouter · Data & privacy**
- Timezone: searchable combobox, shows current local time preview.
- Data & privacy: export my data, delete account (AlertDialog with typed confirmation), plain-language data map ("What we store / what we never store").

### 8.12 Landing page (public)

Purpose: convert skeptics. Tone: honest, specific, craft-forward.

1. **Hero (left-aligned, asymmetric):** Fraunces display headline, e.g. *"Turn what you build into posts that sound like you."* Subhead one sentence. Primary CTA "Start free with your own key" + secondary "See how it works". Right: a real product screenshot in a slightly rotated "paper" frame with a **subtle Spotlight**.
2. **Trust strip:** "Bring your own OpenRouter key · Your key never touches our database · No fake engagement, no scraping."
3. **Sticky-scroll story (Tracing Beam):** Source → Angles → Draft → Evaluate → Check repetition → Schedule. Each with a real UI crop.
4. **Bento grid (asymmetric):** Brand Voice, Knowledge Memory, Quality Evaluator, Repetition Radar, Planner, Calendar.
5. **"How we handle your key"** section — transparent, links to a short security doc.
6. **FAQ (Accordion):** cost (you pay OpenRouter directly), privacy, "does it train on my data" (no), LinkedIn compliance.
7. **Final CTA** + minimal footer.

No fabricated testimonials or metrics. If none exist, omit the section.

---

## 9. Motion & microinteractions

**Principles:** purposeful, fast, interruptible, reducible.

| Property | Value |
|---|---|
| Micro (hover, toggle) | 120–160 ms, `ease-in-out-soft` |
| Standard (panel, popover) | 200–260 ms, `ease-out-expo` |
| Page/section enter | 350 ms `fade-up` (6 px translate), staggered 40 ms |
| Max duration anywhere | 500 ms (except streaming text) |

**Signature moments**
1. **First draft reveal:** streaming text + a single soft ember underline sweep under the hook (400 ms).
2. **Score ring fill:** animates from 0 to value in 600 ms on first evaluation only (not on every tab switch).
3. **Approve:** button morphs to a moss check; row in Library pulses once.
4. **Scheduled:** the calendar cell gets a sky dot that scales in (spring).
5. **Key connected:** collapse animation + moss tick (no confetti anywhere in the app).
6. **Brand caret:** logo caret blinks once on page load.

**Reduced motion:** honor `prefers-reduced-motion` — disable streaming animation (render instantly), ring fills, parallax, spotlights, and moving borders; keep opacity-only fades.

---

## 10. States: loading, empty, error, success

Design all four for every data-driven view.

| State | Pattern |
|---|---|
| **Loading (known layout)** | Skeleton blocks matching real layout, 1.4 s gentle pulse (no harsh shimmer). |
| **Loading (AI)** | Step trail + streaming text; never an indefinite spinner without context. |
| **Empty** | Custom line illustration (single ink stroke, ember accent), 1-line value statement, 1 CTA. Never "No data." |
| **Error** | Icon + plain-language title + cause + single recovery action. Never expose stack traces, secrets, or raw provider messages. Include a support-safe reference ID (mono) for bug reports. |
| **Success** | Toast (Sonner) bottom-right, 4 s, with Undo where reversible. |
| **Offline** | Persistent slim banner "You're offline. Changes will sync when you're back." Drafts held locally. |
| **Partial** | e.g. draft generated but evaluation failed → show draft with amber "Evaluation unavailable · Retry" (never block the main result). |

**Optimistic UI:** save, approve, reject, delete (with undo), calendar drag.

---

## 11. Forms & validation

- Labels above inputs (always visible; no placeholder-as-label).
- Validate on blur, then on change after first error. Don't shout on first keystroke.
- Error text: specific, kind, actionable ("Use at least 12 characters" not "Invalid password").
- Required fields marked only when *most* are optional; otherwise mark optional.
- Group related fields; maximum 1 column on forms under 480 px.
- Paste-friendly: trim whitespace, normalize quotes, strip invisible characters.
- Unsaved changes: browser `beforeunload` + in-app dialog.
- All validation mirrors backend Pydantic rules (length limits, enums) from a shared constants file.

---

## 12. Voice & microcopy

**Tone:** plain, specific, a little dry, never breathless. Sounds like a good editor.

| Don't | Do |
|---|---|
| "Unleash AI-powered magic!" | "Draft a post from your notes." |
| "Oops! Something went wrong 😢" | "We couldn't reach OpenRouter. Your draft is safe. Retry." |
| "Supercharge your LinkedIn growth" | "Write posts that sound like you." |
| "Score: 87/100 — amazing!" | "Specificity 4/5. Add one concrete number." |
| "Success!" | "Draft saved." |
| "Invalid input" | "Add a source of at least 80 characters." |

**Principles:** verb-first buttons ("Generate drafts", "Schedule post"); sentence case everywhere; no exclamation marks except truly rare moments; no emoji in UI chrome; numbers over adjectives; explain *why* when blocking.

**Honesty strings (must appear):**
- Scores: "Advisory. They don't predict engagement."
- Similarity: "A heuristic, not proof of copying."
- Feedback: "Shapes future drafts as context. Doesn't retrain a model."
- Plans: "Never published automatically."
- Key: "Lives in this tab's memory only."

---

## 13. Accessibility (WCAG 2.2 AA minimum)

- **Contrast:** ≥ 4.5:1 body, ≥ 3:1 large text & UI components (verified for both themes).
- **Keyboard:** every action reachable; visible 2 px ember focus ring; logical tab order; skip-to-content link; focus trap in dialogs, restored on close.
- **Screen readers:** semantic landmarks (`nav`, `main`, `aside`), `aria-live="polite"` for generation progress and toasts, `aria-busy` on regions in loading, labelled score rings (`role="img" aria-label="Specificity 4 out of 5"`).
- **Color is never the only signal:** status badges include icon + text; score bars include numerals; diff includes +/− markers.
- **Targets:** ≥ 44×44 px touch targets on mobile (24×24 minimum on desktop per WCAG 2.2).
- **Motion:** respect reduced motion; no flashing >3 Hz.
- **Forms:** associated labels, `aria-describedby` for hints/errors, error summary at top for long forms.
- **Zoom/Reflow:** usable at 200% zoom and 320 px width without horizontal scroll.
- **Drag interactions** (planner, calendar) have keyboard/menu alternatives ("Move to…").
- **Text resize:** use `rem`; no fixed-height text containers.

---

## 14. Responsive behavior

| Breakpoint | Behavior |
|---|---|
| `<640` (mobile) | Bottom tab bar; single column; editor with bottom-sheet Review; calendar defaults to List; sticky bottom CTA; 16 px gutters |
| `640–1023` (tablet) | Icon rail; two-pane editor (Paper + tabbed side); month calendar |
| `1024–1279` (laptop) | Full sidebar; Paper + collapsible Review panel |
| `≥1280` (desktop) | Full three-pane editor, resizable panes |

Test at 360, 390, 768, 1024, 1280, 1536 widths. Never rely on hover alone for essential actions (touch parity).

---

## 15. Dark mode

- Default: **system preference**, toggle in topbar/settings.
- Warm near-black (not `#000`) to preserve the paper/ink identity; avoid pure white text (use `--ink` cream).
- Reduce ember saturation slightly in dark (provided tokens) to avoid vibration.
- Editor "paper" stays slightly lighter than background (elevation by lightness, not shadow).
- Remove paper-grain texture or reduce to 1.5% in dark.
- Verify charts, diff colors, and score colors for contrast in both themes.

---

## 16. Performance & perceived speed

- Route-level code splitting (`React.lazy`) — Landing, Editor, Calendar, Analytics split.
- Lazy-load heavy libs (Recharts, dnd-kit, Aceternity effects) only on routes that use them.
- Self-host fonts, `font-display: swap`, preload Fraunces 600 + Geist 400/500 only; subset to Latin.
- Aceternity effects gated: skip on low-power devices / reduced motion.
- Debounce autosave (800 ms) and search (250 ms).
- Image/screenshot assets in AVIF/WebP with explicit width/height (no layout shift).
- Target: LCP < 2.0 s on landing, INP < 200 ms in app, CLS < 0.05.

---

## 17. Trust, safety & ethics (UX-level requirements)

- The key is **never** shown in full, logged in the UI, or placed in URLs; masked display only; input uses `autocomplete="off"` and `type="password"`.
- Never persist the key in `localStorage`/`sessionStorage`/cookies (UI preferences like sidebar collapse and theme are fine).
- Error messages are sanitized; show a reference ID, not internals.
- **No dark patterns:** no fake urgency, no guilt-based streaks, no hidden cancel/delete, no pre-checked consent boxes.
- **Streaks (if included):** neutral "Weeks with at least one post: 6" — informational, no shame on break.
- Clear, easy account deletion and data export.
- Disclose AI use: AI-generated content is labeled in history ("Drafted by AI · edited by you") for the user's own transparency.
- Do not imply guaranteed results anywhere.

---

## 18. Component specs (key custom components)

### `KeyStatusPill`
Height 28 px, `rounded-full`, 1px border, 8 px dot + label (13 px/500). States: connected (moss), reconnect (amber), none (ink-3). Popover with model switch + disconnect.

### `ScoreRing`
SVG ring, 64 px (compact) / 96 px (hero). Track `--line`, progress colored by value: 1–2 rose, 3 amber, 4–5 moss. Center numeral mono 600. `aria-label` descriptive.

### `CriterionRow`
`[Label] [5 segments] [score]` → expandable. Segments 6×18 px, 3 px gap, `rounded-sm`. Expanded: explanation (small, ink-2) + suggestion card with **Apply** (ghost+icon).

### `SourceChip`
Pill: small doc icon + truncated title (max 24 ch) + × (removable). Hover card shows the chunk preview and relevance. Variants: `grounded` (moss soft), `neutral`.

### `SimilarityCard`
Left: mono score + vertical bar. Middle: title, date, "Why flagged" line. Right: actions menu. Amber border-left 3 px when ≥ threshold.

### `AngleCard`
`rounded-card`, 1px border, hover lifts 2 px and border → ink-3, selected → 2px ember border + check. Contains angle name (h3), hook preview (Fraunces 15/22, 3-line clamp), "why this works" micro line.

### `LinkedInPreview`
Neutral feed-card mock: avatar placeholder, user name, "Just now · 🌐"-free (no emoji; use icon), text with "…see more" truncation at ~3 lines, reaction row placeholders. Not a trademark clone.

### `JobStatusBadge`
Queued (neutral), Running (sky + subtle pulse dot), Succeeded (moss), Retrying n/max (amber), Failed (rose). Tooltip gives next retry time.

### `TrustNote`
Inline small block: shield icon + 13 px text, `--surface-2` fill, 10 px radius. Used near the key input, plan banner, analytics footnote.

### `EmptyState`
Line illustration (SVG, ink stroke 1.5, one ember accent), title (h3), 1-line description, one primary action.

---

## 19. Suggested file/folder structure for UI code

```
frontend/src/
├── components/
│   ├── ui/                 # shadcn primitives (restyled)
│   ├── aceternity/         # a small wrapper set, lazy-loaded
│   ├── brand/              # Logo, KeyStatusPill, TrustNote, EmptyState
│   ├── editor/             # PostEditor, LinkedInPreview, DiffViewer, SelectionToolbar
│   ├── review/             # ScoreRing, CriterionRow, SimilarityCard, FeedbackForm
│   ├── studio/             # SourceInput, InsightsPanel, AngleCard, SettingsPanel
│   ├── planner/            # PlanWeekBoard, PlanCard
│   └── calendar/           # CalendarGrid, ScheduleSheet, JobStatusBadge
├── pages/                  # Landing, Login, Register, Studio, Editor, Library, ...
├── hooks/                  # useOpenRouterKey (memory only), useAutosave, useTheme
├── api/                    # fetch client (attaches key header in-memory only)
├── lib/                    # utils (cn), constants (shared validation), dates (tz)
└── styles/index.css        # tokens, grain, base
```

`useOpenRouterKey` must store the key in a module-level variable / React context (memory) — **never** in web storage — and expose `connect`, `disconnect`, `status`. The API client attaches it as a dedicated header per request and strips it from any error/logging path.

---

## 20. Implementation priority (aligns with TRD phases)

| Phase | UI deliverables |
|---|---|
| 1 Foundation | Tokens, Tailwind config, fonts, shadcn restyle, app shell, theme toggle |
| 2 Auth & BYOK | Auth screens, KeyStatusPill, key connection card + trust panel, session-expiry modal |
| 3 Content Studio | Studio form, insights panel, angle cards, Paper editor, autosave, Brand Voice |
| 4 RAG & evaluation | Knowledge base, SourceChips, Review panel (scores, repetition, feedback), DiffViewer |
| 5 Planning & scheduling | Planner board, Calendar, Schedule sheet, JobStatusBadge |
| 6 Polish | Landing page (Aceternity accents), analytics, empty/error states audit, a11y audit, perf pass |

---

## 21. Design QA checklist (run before every release)

**Visual**
- [ ] Exactly one ember primary action per view
- [ ] No purple gradients, sparkle icons, or emoji in chrome
- [ ] Fonts: Fraunces for display, Geist for UI, Mono for numbers only
- [ ] Spacing follows the 8-pt scale; radii follow role rules
- [ ] Looks right in light **and** dark

**UX**
- [ ] First draft reachable in < 3 minutes from signup
- [ ] Every screen has loading, empty, error, and success states
- [ ] Every destructive action confirms or offers undo
- [ ] Every AI output shows its grounding and honesty note
- [ ] No dead ends: each state offers a next action

**Trust & security**
- [ ] Key never in storage, URL, logs, or error messages
- [ ] KeyStatusPill accurate after refresh
- [ ] Error messages sanitized with reference ID

**Accessibility**
- [ ] Keyboard-only run-through of core flow passes
- [ ] Screen reader announces generation progress and results
- [ ] Contrast verified (both themes); color never sole signal
- [ ] Reduced-motion verified

**Performance**
- [ ] LCP < 2.0 s, INP < 200 ms, CLS < 0.05
- [ ] Aceternity effects lazy-loaded and gated

---

## 22. Closing guidance for the builder

1. **Restraint is the luxury.** When in doubt, remove a border, a shadow, a color, or a word.
2. **Build the editor first and best.** If the Paper feels wonderful, the product feels premium.
3. **Let the real content carry the design.** Real drafts, real scores, real sources — never lorem ipsum in screenshots.
4. **Treat honesty as a feature.** Advisory scores, heuristic similarity, and transparent key handling are the differentiator against generic AI post generators — and they are exactly what skeptical developers and founders trust.
5. **Review against the bans list (§1.3)** at every milestone. The moment the UI starts to look like a template, strip it back to ink, paper, and one ember accent.
