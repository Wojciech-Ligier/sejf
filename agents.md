# Safe Game — Project Brief & Agent Task Board

> **Purpose:** This repository hosts a tiny web game where the player manages a “safe”. When the safe is open, its contents (text and/or image) can be viewed and edited. The player can then close the safe by setting a PIN and (optionally) arming self‑destruction rules. The loop continues until the safe explodes (is destroyed). This file explains the scope, rules, architecture, and the step‑by‑step plan. Code agents (e.g., Codex) should use the checklists below to track progress.

---

## 1) Game Concept (Authoritative Spec)

**Core loop**

1. **Start:** The game begins with a **new, open safe**. Contents are empty.
2. **Open state:** Player can see contents and:
   - Edit **text** content.
   - Choose/replace an **image** (from local file). Preview must be visible.
   - Edit **settings** (language; destruction conditions; survival option).
   - **Close** the safe. When closing, the player **sets a PIN** (or updates it).
3. **Closed state:**
   - Player must enter the **PIN** to reopen.
   - **Self‑destruct** may trigger by **time** (if armed) or by **exceeded PIN attempts** (if armed). Both conditions are **optional**.
4. **Explosion (destruction):**
   - If the “**Can content survive the explosion?**” option is **checked**, there is a **10%** chance that the contents **survive** the explosion.
   - If contents **survive**, the safe **remains closed** with the _same PIN and settings_, the contents are intact, and play continues.
   - If contents **do not survive**, the safe is **destroyed** → the game **spawns a new open safe** with **empty contents** and default settings, and the loop repeats.

**Destruction conditions**

- **Autodestruct timer** (optional): 1–999 minutes after closing the safe. If not set, no time‑based destruction.
- **PIN attempt limit** (optional): if set, after N wrong PIN entries the safe explodes. If not set, unlimited attempts.

**Languages**

- UI supports **PL / EN / IT**. The language is configurable in settings and persists between sessions.

**Survival chance**

- A checkbox **"Can content survive the explosion?"** (default: unchecked). If checked, survival chance is **10%** per explosion event.

**Security note**

- This is a **toy game**. PINs are **not for real security**. We will hash PINs client‑side only to avoid casual disclosure, but this provides **no strong protection**.

---

## 2) UX Outline

**Main areas**

- **Safe panel**
  - **Open state:** content editor (text area), image picker with preview, settings button, close button.
  - **Closed state:** PIN input, attempts remaining (if limited), time to autodestruct (if armed), open button.
- **Settings modal** (available only when safe is open)
  - **Language:** PL / EN / IT (immediate apply).
  - **Autodestruct timer:** disabled | 1–999 minutes.
  - **Attempt limit:** disabled | positive integer (recommend UI 1–999).
  - **Survival option:** checkbox → if checked, 10% chance to keep contents on destruction.
  - **Save settings**.
- **Close flow**
  - Require **PIN** and **Confirm PIN** when closing. If PIN exists, allow updating it here.
- **Explosion feedback**
  - Visible animation/message: “**Explosion!**” + result (“**Contents survived**” or “**Destroyed**”).

**Accessibility**

- Full keyboard navigation, labels for inputs, ARIA roles for dialogs, focus management.

---

## 3) State Model

```ts
// Pseudo‑TypeScript
export type Lang = 'en' | 'pl' | 'it';

export interface SafeContent {
  text: string;
  imageDataUrl?: string; // stored as Data URL; consider size limits
}

export interface SafeSettings {
  language: Lang;
  survivalEnabled: boolean; // 10% chance on destruction
  autodestructMinutes?: number; // 1–999, undefined = disabled
  pinAttemptsLimit?: number; // positive integer, undefined = unlimited
}

export interface SafeRuntime {
  state: 'open' | 'closed';
  pinHash?: string; // sha256 of pin; undefined only in open/no‑pin pre‑close state
  attemptsMade: number; // counts wrong attempts in current closed cycle
  closedAt?: number; // epoch ms
  destructAt?: number; // epoch ms, if timer armed
}

export interface SafeSnapshot {
  id: string; // uuid
  content: SafeContent;
  settings: SafeSettings;
  runtime: SafeRuntime;
}
```

**Lifecycle**

- **Spawn** new safe → `state = 'open'`, empty content, defaults.
- **Close**:
  - Require PIN (+confirmation). Store `pinHash` (sha256). Set `closedAt`.
  - If timer armed → set `destructAt = closedAt + minutes*60*1000`.
  - Reset `attemptsMade = 0`.
- **Open** (correct PIN): switch to `state = 'open'` and keep content/settings.
- **Wrong PIN**: increment `attemptsMade`. If `attemptsMade` reaches `pinAttemptsLimit`, trigger explosion.
- **Timer check**: on app resume or every tick, if `now >= destructAt`, trigger explosion.
- **Explosion**:
  - Roll survival if `survivalEnabled`: 10% success using `crypto.getRandomValues`.
  - If survive: keep snapshot as is (remain `state = 'closed'`).
  - If not survive: discard snapshot; spawn a fresh open safe with defaults.

---

## 4) Persistence & Security

- **Persistence:** `localStorage` key `safe-game:v1` stores the current `SafeSnapshot`.
- On load, validate and migrate if needed. Recompute timers from timestamps to handle page reloads.
- **PIN handling:** store **sha256 hash** of the PIN (Web Crypto API). No plaintext PIN persistence. Still **not secure**.
- **Image size:** recommend soft limit (e.g., ≤ 1.5 MB). Optionally compress to Data URL via `<canvas>`.

---

## 5) Internationalization (EN/PL/IT)

- Store all strings in `i18n/<lang>.json`.
- Language switch updates UI immediately and persists.
- Provide complete coverage before release. Use keys like `ui.open`, `ui.closed`, `msg.explosion`, etc.

---

## 6) Technology & Project Layout

**MVP stack (no backend):**

- **Vite + TypeScript + Vanilla DOM** (no framework) for minimal footprint.
- Plain CSS with a small utility layer (e.g., CSS variables) for theming.

**Repo structure**

```
/ (root)
  ├─ index.html
  ├─ src/
  │   ├─ main.ts
  │   ├─ ui/ (DOM helpers, dialogs)
  │   ├─ state/ (state machine, persistence)
  │   ├─ i18n/
  │   │   ├─ en.json
  │   │   ├─ pl.json
  │   │   └─ it.json
  │   └─ types.d.ts
  ├─ styles/
  │   └─ app.css
  ├─ tests/
  │   ├─ unit/ (state tests)
  │   └─ e2e/  (Playwright)
  ├─ AGENTS.md (this file)
  ├─ README.md (player‑facing)
  └─ LICENSE
```

**Build/Run**

- `npm i`
- `npm run dev` (Vite dev server)
- `npm run build` → `dist/`

---

## 7) Definition of Done (DoD)

- All rules in **Game Concept** implemented.
- Works offline in a modern browser (desktop & mobile) without backend.
- Reload‑safe timers and limits.
- a11y pass (labels, focus, keyboard, color contrast).
- i18n: **EN, PL, IT** complete.
- Unit tests: state machine, survival roll, timer expiration, attempt limit.
- E2E tests: happy path + explosion paths.
- README with screenshots/gifs.

---

## 8) Risks & Non‑Goals

- **Non‑goal:** strong security. PIN is for gameplay only.
- **Risk:** background tabs/sleep may delay timers; mitigated by comparing `destructAt` on wake.
- **Risk:** Large images bloat `localStorage`; compress or bound size.

---

## 9) Agent Workflow (for Codex or similar)

- Use the **Task Board** below. When completing an item, **tick the checkbox** and add a short note under **Changelog** with commit hash.
- If you adjust scope, update **Assumptions** and **Open Questions**.
- Keep PRs small; reference the relevant checklist item in the description.

---

## 10) Task Board (track progress here)

### A. Foundations

- [x] Initialize Vite + TypeScript project, ESLint, Prettier.
- [x] Set up `index.html`, basic layout, and `app.css`.
- [x] Define TypeScript types (`types.d.ts`).

### B. State & Persistence

- [x] Implement `SafeSnapshot` state machine with events (open, close, wrongPin, tick, explode, survive).
- [ ] PIN hashing via Web Crypto (sha256).
- [ ] `localStorage` persistence with migration.
- [ ] Timer handling (`destructAt`) with wake‑up check.

### C. UI/UX

- [ ] Open state UI: text editor, image picker + preview, settings button, close button.
- [ ] Close flow: PIN + Confirm PIN modal.
- [ ] Closed state UI: PIN input, attempts remaining (if any), timer countdown (if any), open button.
- [ ] Explosion feedback (animation/message) + survival result text.
- [ ] Accessibility: labels, focus traps in modals, keyboard shortcuts.

### D. Settings & i18n

- [ ] Settings modal (open‑only): language, timer minutes (1–999 or disabled), attempts limit (≥1 or disabled), survival checkbox.
- [ ] i18n files: **en.json**, **pl.json**, **it.json** (100% coverage).
- [ ] Language switcher (persists across sessions).

### E. Media Handling

- [ ] Image selection (file input) → Data URL preview.
- [ ] Optional image compression (canvas) + size guard with user feedback.

### F. Game Logic Edge Cases

- [ ] Reload while closed: enforce timer/attempts correctly.
- [ ] Attempt limit reached triggers explosion exactly once.
- [ ] Survival chance roll using `crypto.getRandomValues` (10%).
- [ ] Post‑explosion state: survive → remain closed; fail → new open safe with defaults.

### G. Testing & Docs

- [ ] Unit tests: state transitions, hashing, survival roll, timer expiry, attempts.
- [ ] E2E tests (Playwright): happy path, wrong PIN path, timer path.
- [ ] README with quick start + screenshots.
- [ ] LICENSE (MIT by default unless changed).

---

## 11) Assumptions (current)

- Persistence uses **localStorage** only (no backend).
- Autodestruct **minutes range is 1–999**; attempts limit is **any positive integer** (UI bounded 1–999).
- On **survive**, safe **stays closed** and contents remain; on **failure**, a **brand‑new open safe** spawns.
- PIN can be **changed** whenever the safe is open (during the close flow).

---

## 12) Open Questions (for the project owner)

1. **Persistence scope:** OK to keep it client‑side only (localStorage)? Any need for shareable links or cloud save?
2. **Attempts range:** Should we constrain attempts to 1–999 like the timer, or allow larger values?
3. **Image constraints:** Preferred max size and formats (JPEG/PNG/WebP)? Should we auto‑compress?
4. **Explosion UX:** Should we add sound/vibration/animation, or keep it minimal text feedback?
5. **Visual style:** Minimalist “app” look ok, or do you want a skeuomorphic safe design?

---

## 13) Changelog (agents append entries here)

> Format: `YYYY‑MM‑DD • short note • commit <hash>`

- 2025-09-12 • initialize Vite + TypeScript project, ESLint, Prettier, Wrangler setup • commit 361ee49
- 2025-09-12 • set up basic layout with placeholder safe panel • commit 11b7b69
- 2025-09-12 • define core TypeScript types • commit a49745c
- 2025-09-12 • implement SafeSnapshot state machine • commit 82d8e61

---

## 14) License

- Default to **MIT** unless the repository specifies otherwise.
