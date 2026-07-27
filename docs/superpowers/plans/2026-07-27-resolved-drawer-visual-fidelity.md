# Resolved drawer visual fidelity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the virtual-agent `ResolvedDrawer` match the sample’s green auto-resolve alert and timeline by restyling with Tailwind token utilities so operators/specialists CSS can no longer collide.

**Architecture:** Keep drawer shell classes (`.drawerwrap`, `.drawer`, `.dh`, `.dpill`, `.dtype`, `.dsec`, `.dtable`, `.dfoot`). Replace only the colliding recommendation/timeline class names (`.rec`, `.tl`, `.step`, `.dot`, `.st`, `.pfx`, `.ln`, `.concl`, `.lead`, `.bc`) with Tailwind utilities on those nodes. Visual values come from sample monitor CSS (`sample/styles.css` ~295–307) and the approved spec.

**Tech Stack:** Next 16, React 19, TypeScript, Tailwind v4 (`@theme` tokens in `globals.css`), Vitest + Testing Library, Jotai (already used by the drawer).

**Design spec:** `docs/superpowers/specs/2026-07-27-resolved-drawer-visual-fidelity-design.md`

## Global Constraints

- **Branch:** after the open PR is merged to `main`, create `fix/resolved-drawer-visual` from up-to-date `main`. Do not implement on `main` directly.
- **TDD mandatory:** red → green → refactor, one vertical slice per commit.
- **Test location:** `__tests__/` beside the unit under test.
- **Test runner (from `apps/web/`):** `pnpm exec vitest run <path>`; whole app `pnpm test`.
- **Scope:** `ResolvedDrawer` only. Do not change operators/specialists styles, IntakeDrawer, drill page, or `PolicyLink` color.
- **Styling:** Tailwind utilities referencing `@theme` tokens (`ok`, `tx`, `tx2`, `tx3`, `line`, `bg`, `font-mono`). No new colliding global class names for alert/timeline.
- **Keep plan Global Constraints aligned with root `AGENTS.md`.**

## File Structure

```
apps/web/src/modules/virtual_agents/
  components/
    ResolvedDrawer.tsx                 # modify: Tailwind on alert + timeline
    __tests__/
      ResolvedDrawer.test.tsx          # create: collision-proof style contract
  style.css                            # modify: delete unused .rec / .tl* rules
```

No new modules, hooks, or API changes.

---

### Task 1: Tailwind alert + timeline (collision-proof)

**Files:**
- Create: `apps/web/src/modules/virtual_agents/components/__tests__/ResolvedDrawer.test.tsx`
- Modify: `apps/web/src/modules/virtual_agents/components/ResolvedDrawer.tsx`
- Modify: `apps/web/src/modules/virtual_agents/style.css` (delete dead `.rec` / `.tl*` rules only)

**Interfaces:**
- Consumes: `AnalysisRecord` from `@/modules/virtual_agents/types`; `PolicyLink`; `closeDrawerAtom`
- Produces: same `ResolvedDrawer({ analysis }: { analysis: AnalysisRecord })` public API; markup no longer uses colliding class names listed in the spec

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/modules/virtual_agents/components/__tests__/ResolvedDrawer.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResolvedDrawer } from "@/modules/virtual_agents/components/ResolvedDrawer";
import type { AnalysisRecord } from "@/modules/virtual_agents/types";

const analysis: AnalysisRecord = {
  id: "iss_004",
  txnId: "txn_5998",
  resolvedAt: "10:42:05",
  type: "Refund — changed mind",
  amountText: "$149.00",
  rec: {
    lead: "✓ AUTO-RESOLVED — refund approved",
    because: "Within the 14-day window (<b>day 3</b>).",
    ref: 77,
  },
  trace: [
    {
      src: 77,
      status: "fired",
      rule: "Auto-resolve if within 14 days AND item hasn’t shipped.",
      evidence: "Purchased 3 days ago · shipping status = not_shipped → both true.",
    },
    {
      src: 79,
      status: "applied",
      rule: "Installment plans: refund paid installments; cancel remaining.",
      evidence: "1 of 4 paid → refund the paid portion.",
    },
  ],
  conclusion: "→ Refund approved automatically · no human involved",
  context: [["Customer", "Morgan L."]],
  audit: "<b>who:</b> virtual agent",
};

describe("ResolvedDrawer", () => {
  it("renders recommendation lead, status, and conclusion", () => {
    render(<ResolvedDrawer analysis={analysis} />);
    expect(
      screen.getByText("✓ AUTO-RESOLVED — refund approved"),
    ).toBeInTheDocument();
    expect(screen.getByText("✓ fired")).toBeInTheDocument();
    expect(screen.getByText("✓ applied")).toBeInTheDocument();
    expect(
      screen.getByText("→ Refund approved automatically · no human involved"),
    ).toBeInTheDocument();
  });

  it("styles alert + timeline with Tailwind tokens (no colliding .rec/.tl classes)", () => {
    const { container } = render(<ResolvedDrawer analysis={analysis} />);

    expect(container.querySelector(".rec")).toBeNull();
    expect(container.querySelector(".tl")).toBeNull();

    const lead = screen.getByText("✓ AUTO-RESOLVED — refund approved");
    expect(lead.className).toMatch(/text-ok/);
    const alert = lead.parentElement;
    expect(alert?.className).toMatch(/border-ok\/32/);
    expect(alert?.className).toMatch(/bg-ok\/8/);

    const fired = screen.getByText("✓ fired");
    expect(fired.className).toMatch(/text-ok/);

    const concl = screen.getByText(
      "→ Refund approved automatically · no human involved",
    );
    expect(concl.className).toMatch(/text-ok/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web && pnpm exec vitest run src/modules/virtual_agents/components/__tests__/ResolvedDrawer.test.tsx
```

Expected: FAIL — first test may pass; second fails because `.rec` / `.tl` still exist and lead/status lack `text-ok` / `border-ok/32` / `bg-ok/8` utilities.

- [ ] **Step 3: Implement Tailwind on alert + timeline**

Replace the recommendation and timeline blocks in `ResolvedDrawer.tsx` (keep shell classes). Full component after change:

```tsx
"use client";

import { useSetAtom } from "jotai";
import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import type { AnalysisRecord } from "@/modules/virtual_agents/types";
import { closeDrawerAtom } from "@/modules/virtual_agents/data/atoms/drawer";
import "../style.css";

export function ResolvedDrawer({ analysis }: { analysis: AnalysisRecord }) {
  const close = useSetAtom(closeDrawerAtom);
  return (
    <div className="drawerwrap open">
      <div
        className="drawerbg"
        data-testid="drawer-backdrop"
        onClick={() => close()}
      />
      <div className="drawer">
        <div className="dh">
          <span className="ids">
            {analysis.id} · {analysis.txnId}
          </span>
          <button type="button" className="close" onClick={() => close()}>
            ✕
          </button>
        </div>
        <span className="dpill done">
          Resolved automatically · {analysis.resolvedAt}
        </span>
        <div className="dtype">
          <span className="ty">{analysis.type}</span>
          <span className="am">{analysis.amountText}</span>
        </div>
        <div className="dsec">What the agent decided</div>
        <div className="mb-1.5 rounded-[10px] border border-ok/32 bg-ok/8 px-[14px] py-3">
          <div className="font-mono text-[13px] font-bold tracking-[0.2px] text-ok">
            {analysis.rec.lead}
          </div>
          <div className="mt-[7px] text-[13px] leading-normal text-tx2 [&_b]:text-tx">
            {/* Fixtures are trusted authored HTML (may contain <b>). */}
            <span dangerouslySetInnerHTML={{ __html: analysis.rec.because }} />{" "}
            See <PolicyLink line={analysis.rec.ref} />.
          </div>
        </div>
        <div className="dsec">How it got there</div>
        <div className="ml-1.5 mt-1.5">
          {analysis.trace.map((c) => (
            <div
              key={`${c.src}-${c.rule}`}
              className="relative border-l-2 border-line pb-4 pl-[22px] last:border-l-transparent last:pb-0"
            >
              <div className="absolute -left-2 top-0.5 h-[14px] w-[14px] rounded-full border-2 border-ok bg-bg" />
              <div className="mb-[7px] flex items-baseline gap-2.5">
                <PolicyLink line={c.src} />
                <span className="font-mono text-[11px] text-ok">
                  ✓ {c.status}
                </span>
              </div>
              <div className="flex gap-3 text-[12.5px] leading-normal">
                <span className="w-[66px] shrink-0 text-tx3">RULE</span>
                <span className="text-tx">{c.rule}</span>
              </div>
              <div className="mt-1 flex gap-3 text-[12.5px] leading-normal">
                <span className="w-[66px] shrink-0 text-tx3">EVIDENCE</span>
                <span className="text-tx">{c.evidence}</span>
              </div>
            </div>
          ))}
          <div className="relative border-l-2 border-transparent pl-[22px]">
            <div className="absolute -left-[9px] top-0.5 h-4 w-4 rounded-full border-2 border-ok bg-ok" />
            <div className="text-[13.5px] font-semibold text-ok">
              {analysis.conclusion}
            </div>
          </div>
        </div>
        <div className="dsec">Context</div>
        <table className="dtable">
          <tbody>
            {analysis.context.map(([k, v]) => (
              <tr key={k}>
                <td className="k">{k}</td>
                <td className="v">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="dfoot">
          Logged automatically —{" "}
          {/* Fixtures are trusted authored HTML (may contain <b>). */}
          <span dangerouslySetInnerHTML={{ __html: analysis.audit }} />
        </div>
      </div>
    </div>
  );
}
```

End-node layout: sample uses `left: -9px` for the 16px end dot on a 2px rail — keep `-left-[9px]`, `h-4 w-4`, `border-ok bg-ok`.

- [ ] **Step 4: Delete dead CSS**

In `apps/web/src/modules/virtual_agents/style.css`, delete only these rules (they are unused after Step 3; grep the module first to confirm no remaining `className="rec"` / `"tl"` / `"concl"` etc.):

```css
.rec { ... }
.rec .lead { ... }
.rec .bc { ... }
.rec .bc b { ... }
.tl { ... }
.tl .step { ... }
.tl .step:last-child { ... }
.tl .dot { ... }
.tl .step.end .dot { ... }
.tl .shead { ... }
.tl .st { ... }
.tl .ln { ... }
.tl .ln + .ln { ... }
.tl .pfx { ... }
.tl .val { ... }
.tl .step.end .concl { ... }
```

Do **not** delete `.dsec`, `.dtable`, `.dfoot`, `.dpill`, `.drawer*`.

Confirm with:

```bash
rg -n 'className="(rec|tl|lead|bc|st|pfx|ln|concl|step|dot)"' apps/web/src/modules/virtual_agents
```

Expected: no matches in TSX (drawer no longer uses those names).

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/web && pnpm exec vitest run src/modules/virtual_agents/components/__tests__/ResolvedDrawer.test.tsx
```

Expected: PASS (both tests).

Also run the broader virtual_agents suite:

```bash
cd apps/web && pnpm exec vitest run src/modules/virtual_agents
```

Expected: PASS.

- [ ] **Step 6: Manual visual check**

1. `pnpm --filter web dev` (or `cd apps/web && pnpm dev`) on `:3000`
2. Open Resolved drawer for `iss_004` (recent resolved row or drill)
3. Compare to sample `:8000` same ticket: green-tinted alert, green hollow/filled dots, green `✓ fired` / `✓ applied`, compact RULE/EVIDENCE

- [ ] **Step 7: Commit**

```bash
git add \
  apps/web/src/modules/virtual_agents/components/ResolvedDrawer.tsx \
  apps/web/src/modules/virtual_agents/components/__tests__/ResolvedDrawer.test.tsx \
  apps/web/src/modules/virtual_agents/style.css
git commit -m "$(cat <<'EOF'
fix(web): Tailwind-style Resolved drawer to beat CSS collisions

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Green alert border + tint + lead | Task 1 |
| Green timeline dots + status + conclusion | Task 1 |
| Compact RULE/EVIDENCE typography | Task 1 |
| No colliding `.rec`/`.tl` on this drawer | Task 1 |
| Remove unused module CSS | Task 1 Step 4 |
| Out of scope: other boards / IntakeDrawer / PolicyLink color | Not tasked |
| Manual side-by-side success criteria | Task 1 Step 6 |

No placeholders. Single subsystem — one plan.
