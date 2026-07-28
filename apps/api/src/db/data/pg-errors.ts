const UNIQUE_VIOLATION = "23505"; // Postgres error code for a unique constraint

// drizzle-orm wraps driver failures in a DrizzleQueryError, keeping the raw
// `pg` DatabaseError (which carries `.code`) on `.cause`. Walk the cause chain
// so a unique-violation is detected regardless of how many layers wrap it.
export const isUniqueViolation = (err: unknown): boolean => {
  for (
    let e: unknown = err;
    e && typeof e === "object";
    e = (e as { cause?: unknown }).cause
  ) {
    if ((e as { code?: string }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
};
