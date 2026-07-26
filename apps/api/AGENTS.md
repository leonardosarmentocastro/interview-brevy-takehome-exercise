# API — architecture & conventions

Follow these patterns when adding or changing modules. They keep every domain
self-contained and consistent. Follow root `AGENTS.md` (feature branches + TDD).

## Module layout

Each domain lives under `src/modules/<module>/` and owns everything it needs:

```
modules/<module>/
  resolvers/                   # one file per operation (HTTP handlers)
    <verb>-<noun>-resolver.ts
    index.ts                   # barrel re-exporting every resolver
  repository.ts                # all data-access queries for the module
  model.ts                     # table/enum definitions (when persistent)
  schema.ts                    # Zod validation schemas + inferred input types
  types.ts                     # inferred row types
  routes.ts                    # express Router mapping paths -> resolvers
  __tests__/                   # module tests, run against the HTTP surface
    api.test.ts
```

Not every module needs every file. A trivial module (see `health/`) may only
have `resolvers/` and `routes.ts`.

## Resolver pattern (controller + service merged)

We deliberately do NOT use a controller -> service -> repository split. For a
CRUD API those layers are mostly pass-through, so we collapse them into a single
**resolver** layer that sits directly on top of the repository.

- A resolver **is** an Express handler: `(req, res, next) => Promise<void>`.
- One resolver per operation, one file per resolver.
- File name: `<verb>-<noun>-resolver.ts`; export `<verb><Noun>Resolver`. Plural
  noun for collection ops (`listItemsResolver`), singular for item ops
  (`getItemResolver`).
- A resolver's job: read `req`, validate the body, call the repository, apply
  domain rules (e.g. throw `NotFoundError`), and write the response.
- Always wrap the body in `try/catch` and forward errors with `next(err)`.
  Never translate errors inline — the central error handler owns that.

```ts
export const getItemResolver = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const found = await itemsRepository.findById(req.params.id);
    if (!found) throw new NotFoundError(`item ${req.params.id} not found`);
    res.status(200).json(found);
  } catch (err) {
    next(err);
  }
};
```

## Data access

- All data access goes through `repository.ts`. Resolvers never build queries or
  import a client directly — this keeps queries reusable and lets them grow into
  multi-step/transactional operations without bloating resolvers.
- The base app is **database-free**. When a module needs persistence, apply the
  Drizzle/Postgres pack (see "Adding persistence" below); the `repository.ts`
  seam means resolvers don't change when the backing store does.

## Validation & errors

- Validate request bodies inline as the first step of create/update resolvers:
  `const input = createItemSchema.parse(req.body)`.
- Throw domain errors from `@/db/data/errors` and let them bubble via
  `next(err)`.
- The central handler `server/middlewares/error-handler-middleware.ts` maps:
  malformed JSON -> `400`, `ZodError` -> `400`, `NotFoundError` -> `404`,
  anything else -> `500`.

## Routing

- Each module exports a `Router` from `routes.ts` (paths relative to its mount
  point, e.g. `"/"` and `"/:id"`).
- Mount every module router in `src/server/routes/connect.ts` under its base
  path. That file is the single source of truth for what is mounted where.

## Testing

- **TDD is mandatory** for every behavior change (see root `AGENTS.md`).
- Tests live in `modules/<module>/__tests__/` and exercise the module through
  **HTTP** (the real contract) rather than internal functions.
- Shared test infra (server bootstrap) lives in `test/` and is imported via the
  `@test/*` alias, e.g. `@test/helpers`.
- Cross-cutting server code (e.g. `server/middlewares/`) is tested where it is
  owned. When a behavior needs a route to exercise it, add a **test-only** router
  inline in `server/routes/connect.ts`, mounted only when `NODE_ENV === "test"`.

## Adding a new module (checklist)

1. `model.ts`, `schema.ts`, `types.ts` (as needed)
2. `repository.ts`
3. `resolvers/*` + `resolvers/index.ts`
4. `routes.ts`
5. Mount the router in `src/server/routes/connect.ts`
6. `__tests__/api.test.ts`

## Adding persistence (opt-in)

When the first persistent module arrives, add the Drizzle/Postgres pack:
`db/client.ts`, a `DATABASE_URL` in `config/env.ts`, `drizzle.config.ts`, a
`docker-compose.yml`, and DB-reset test hooks (`test/global-setup.ts`,
`test/setup.ts`). The starter kit ships these as templates.
