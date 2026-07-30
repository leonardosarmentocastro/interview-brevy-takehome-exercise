# Initial files

These are the **original files this project started from** — the raw material
handed over at kickoff, before any application code existed. They are preserved
here, unchanged in intent, purely for historical/reference purposes. Nothing in
the running application (`apps/web`, `apps/api`) imports from this folder.

| File | What it is |
| --- | --- |
| `payment_issues.json` | Seed dataset of payment issues to be triaged. |
| `PROTOTYPE-queue-sketch.html` | The very first throwaway HTML sketch of the triage queue, used to imagine operating the system before building it. |
| `temp.md` | The running scratchpad / brainstorming log that shaped the product: the framing (triage console vs. policy-quality instrument), the three-tier pipeline, and the early feature/TODO notes. |

> `customers.json`, `transactions.json` and `payment_issues.json` have moved
> into `apps/api` — the agent and the ingestion feed read them at runtime, so
> they must ship inside the package. See
> `apps/api/src/modules/issues/ai/data/` and
> `apps/api/src/modules/issues/ingestion/sources/data/`.

The business rules these files were meant to be triaged against live in the
canonical `policies.md` at the repo root (and its typed copy under
`apps/web/src/shared/policies/`). The seed datasets above have since been
reshaped into proper fixtures inside the feature modules
(`apps/web/src/modules/**/data/fixtures/`), which are what the app actually uses.
