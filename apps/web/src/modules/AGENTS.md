# Web modules — structure & naming

Feature code lives in `src/modules/<feature>/` (DDD). When one feature depends
on another, the dependency points one way only (e.g. a details module imports
from its parent, never the reverse).

## Naming
- **Module folders:** `snake_case` — mirrors the API module and any DB table
  names (`payment_issues`).
- **Components:** `PascalCase.tsx`, exactly one component per file (primary
  export). Example: `components/AmountInput.tsx` exports `AmountInput`.
- **Hooks & utils:** `kebab-case.ts`, **one primary export per file**. Prefer
  `utils/format-date.ts` exporting `formatDate` over a grab-bag `utils.ts`.
- **Exception — `types.ts`:** a module's `types.ts` may declare several related
  types together; do not split one type per file.
- **shadcn** primitives stay under `src/components/ui/` with their existing
  (shadcn) naming.

## Testing
Vitest + Testing Library. Tests live in a `__tests__/` folder at the same level
as the unit under test (never co-located beside the file). TDD per root
`AGENTS.md`.
