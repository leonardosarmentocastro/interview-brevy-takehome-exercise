/**
 * Raised when a data lookup finds no matching record.
 *
 * This is a data-layer concern: the service layer throws it after a repository
 * query returns nothing (e.g. `findById` yields `undefined`), and the HTTP
 * error handler maps it to a `404 Not Found` response. Keeping it under
 * `db/data` keeps persistence-related errors close to the data they describe.
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
