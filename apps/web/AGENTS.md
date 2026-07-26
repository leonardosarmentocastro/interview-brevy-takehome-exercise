<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version may have breaking changes — APIs, conventions, and file structure
may differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Web — conventions

Follow root `AGENTS.md` (feature branches + TDD) for all work in this app.

## Layout

```
src/
  app/                 # Next.js App Router pages
  modules/<feature>/   # DDD feature module (snake_case folder)
    api.ts              # domain HTTP client (e.g. itemsAPI)
    components/         # PascalCase.tsx, one component per file
      __tests__/        # component tests (same level as the components)
    hooks/              # kebab-case.ts, one primary export per file
    utils/              # kebab-case.ts, one primary export per file
    schema.ts           # Zod form schema
    types.ts            # web types (multiple related types allowed here)
  shared/api/           # cross-cutting HTTP helper (request)
  components/ui/         # shadcn primitives (keep their own convention)
  lib/                  # cn() and other small shared utils
```

## Testing

- **TDD is mandatory** for behavior changes (forms, table cues, schema rules,
  formatters). Red → green → refactor; one vertical slice at a time.
- Test runner: Vitest + Testing Library (jsdom).
- Tests live in a `__tests__/` folder at the **same level as the file under
  test** (e.g. `components/__tests__/Foo.test.tsx` next to `components/Foo.tsx`).
  Do **not** co-locate `*.test.tsx` beside the file — always the `__tests__/`
  folder, matching the API convention.
- Prefer testing user-visible behavior and pure schema/format helpers over
  mocking deep internals.
- If the harness is missing when you start a feature, add the minimal Vitest +
  Testing Library setup as the first TDD task — do not implement UI without tests.

## Data & forms

- Data fetching uses TanStack Query (`app/providers.tsx` wires the client). The
  domain HTTP client lives in `modules/<feature>/api.ts` on top of
  `shared/api/request.ts`.
- Forms use `react-hook-form` + Zod (`modules/<feature>/schema.ts`). Keep web
  types in `modules/<feature>/types.ts` aligned with the API contract (no shared
  package yet). See `src/modules/AGENTS.md` for naming rules.
