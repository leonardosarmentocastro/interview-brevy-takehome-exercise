# Role Selection & Admin Identity — Screen Design Spec

> **Status:** approved design, captured 2026-07-26. Ready for an implementation plan.
> **Scope:** the presentation entry point for the MVP — a **role-selection modal**
> shown on first arrival, plus a **shared app header** carrying an admin identity
> chip and per-board page title. Sits in front of the three existing boards
> (`sample/`): virtual-agent monitor, operator board, specialist board.
> **Prototype target:** static, hand-authored HTML/CSS/JS in the same spirit as
> the rest of `sample/` — render functions returning HTML strings over fixtures,
> not a live auth engine.
>
> Mockups this spec was derived from (gitignored, throwaway), under
> `.superpowers/brainstorm/694440-*/content/`: `role-modal.html` (Direction A vs
> B), `app-header.html` (header + avatar-glyph compare), `full-flow.html`
> (clickable end-to-end flow — the approved reference).

---

## 1. What this is and why it exists

This is the **presentation opener**. It is not a real authentication or
authorization feature — it is a deliberate **stand-in for the auth/authz layer
that will not be built by the Monday demo.** Its job is to let the presenter
step into the system as an **admin** and, from that vantage point, walk the
technical team through the full ticket lifecycle across all three pipeline
layers.

- **Why a role picker at all.** In production this console would sit behind
  authentication, and authorization would *scope* what each person sees: an
  operator sees only their own board; an operator-manager gets a cross-operator
  aggregate view (not built); the same shape holds for specialists. None of that
  is wired for the demo. The modal makes that intended scoping **legible** —
  it shows the roles that *would* exist and what each *would* see — while
  granting the presenter the one identity that can see everything: **admin.**
- **Two distinct axes, kept separate.** This introduces the **human
  org-hierarchy axis** (admin › specialist › operator). It is deliberately
  *not* the same as the two axes already first-class in the product — **policy**
  ("may this be done?") and **authority** ("may the machine do it alone?").
  Nothing here touches policy or machine-authority logic.
- **Secondary win: visual consistency.** The header this introduces also closes
  two pre-existing discrepancies (see §4): the specialist board being
  full-viewport while the other two are not, and only the virtual-agent view
  having a visible page title.

---

## 2. Role-selection modal

**Direction: identity picker** (chosen over an "access tiers" layout — it reads
like a familiar sign-in and keeps attention on *who you are operating as*).

Presentation:

- Appears **on first arrival**, centered over a **blurred board backdrop**.
- Header block: a small brand line (`PAYMENT ISSUE CONSOLE`), title **"Who's
  operating the console?"**, and a note that **authentication isn't wired in
  this MVP — pick a role to continue.**
- Three role rows, **top to bottom**, each with an avatar tile, a name, and a
  plain-language **scope line** ("what this role would see"):

  | Row | State | Scope line |
  |-----|-------|------------|
  | **Admin** | **enabled**, highlighted, `Continue →` affordance | Full visibility across all three pipeline layers — virtual agent, operator & specialist. |
  | **Specialist / manager** | disabled, locked, `requires auth` tag | Sees the specialist board. Manager sees across all specialists. |
  | **Operator / manager** | disabled, locked, `requires auth` tag | Sees only their own operator board. Manager sees across all operators. |

- Footer line: **"Only Admin is enabled in this build."**
- The two disabled rows are non-interactive (visibly dimmed/greyed, lock glyph,
  `not-allowed` cursor). Only the admin row is clickable.

The scope lines are the crux of the design: they carry the *authorization*
story ("real auth would scope each role like this") without any auth being
implemented. This is the agreed middle ground between a bare stage-setter and a
full permission-model teaser.

---

## 3. Landing behavior

- **Boot changes.** Today the app boots straight to the operator board
  (`showBoard()` in `sample/app.js`). It will instead **show the modal first**,
  over the initial view.
- **On selecting Admin:** the modal closes and the app lands on the
  **virtual-agent view** (`showMonitor()`) — the **top of the pipeline** — so the
  presenter can walk the ticket lifecycle *downward* through operator and
  specialist.
- **No persistence.** A fresh page load shows the modal again. No storage, no
  session state — appropriate for a demo, and keeps the opener reliable.

---

## 4. Shared app header (new chrome on all three boards)

A single header bar is added to the top of **all three boards**, at a
**consistent content width.**

- **Left:** an eyebrow (`Pipeline · layer N of 3`) + the **page title** for the
  current board:
  - layer 1 of 3 — **"Virtual agent — pipeline monitor"**
  - layer 2 of 3 — **"Operator board — for human review"**
  - layer 3 of 3 — **"Specialist board — for fraud & escalations"**
- **Right:** the **admin identity chip** (see §5).

This header does triple duty:

1. Hosts the admin identity indicator (the original ask — somewhere to show we
   are operating as admin, not as operator "Sam").
2. Gives the **operator and specialist boards the page titles they lacked** —
   previously only the virtual-agent view announced where you were.
3. By rendering all three boards with the same header at the same width, it
   **folds the specialist board out of full-viewport** into the shared shell,
   resolving the "specialist board looks fullscreen, the others don't"
   discrepancy.

---

## 5. Admin identity chip

- A pill in the header's top-right: a **circular avatar** reading **`ADM`**
  (the admin initials, info-blue accent), the label **"Admin"**, and a small
  **"switch role"** hint with a caret.
- **Click behavior:** clicking the chip **re-opens the same role-selection
  modal** presented on arrival — directly, with no intermediate popover. This
  lets the presenter re-tell the role story on cue during the demo.
- The chip is a **session-wide identity badge.** It does not alter what any
  board renders (the boards' own content is unchanged); it only signals the
  operating identity.

---

## 6. Left untouched

- The **floating bottom pipeline nav** keeps its existing two-line labels (title
  + description: "Operator board" / "for human review", etc.). It is not
  modified by this work.
- The three boards' **body content, data, and interactions** are unchanged. This
  work adds a wrapper (modal + header + chip) around them; it does not touch
  their internals, the policy/authority logic, or the fixtures.

---

## 7. Component & integration notes

Consistent with the existing `sample/` architecture (render functions returning
HTML strings, event delegation in `app.js`, `node:test` substring assertions):

- **A new render module** (e.g. `sample/lib/shell.js`) exposing:
  - `renderRoleModal()` — the modal markup (hidden/shown via a class toggle,
    same pattern as the existing `polmodal` in `index.html`).
  - `renderAppHeader(view)` — the header bar for a given view id
    (`agent | operator | specialist`), returning the eyebrow, title, and identity
    chip. A small `HEADERS` map keyed by view id holds eyebrow/title strings
    (mirrors the `VIEWS` array in `sample/lib/nav.js`).
- **Wiring in `app.js`:**
  - Each `show*()` function prepends `renderAppHeader(<view>)` to its output,
    alongside the existing `renderPipelineNav(<view>)` suffix.
  - `boot()` renders the initial view and then opens the modal (rather than
    calling `showBoard()` directly).
  - Selecting admin closes the modal and calls `showMonitor()`.
  - A delegated click handler opens the modal when the identity chip is clicked
    (and ignores clicks on the disabled rows).
- **Specialist width normalization:** the `specialist-mode` full-viewport shell
  (`setSpecialistMode` / the `.specialist-mode` body class) is reconciled so the
  specialist board shares the same content-width container and header as the
  other two. Implementation may narrow or remove `specialist-mode`; the visible
  outcome is the one that matters — all three boards read as the same app.
- **Tests:** substring assertions that the modal contains the three role rows
  with admin enabled and the others disabled; that `renderAppHeader` emits the
  correct title/eyebrow per view and the `ADM` chip; and that all three views
  include the header.

---

## 8. Explicitly out of scope

- Real authentication or authorization; any credential entry; any persistence of
  the chosen role.
- Building the specialist or operator (or manager) views/experiences — those
  rows exist in the modal purely to communicate intended scoping.
- Any change to policy logic, machine-authority logic, ticket data, or board
  interactions.
