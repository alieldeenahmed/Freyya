// An error the client should see, with a status code and a stable machine-readable code.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    // Extra response headers, such as Retry-After on a rate limit.
    readonly headers?: Record<string, string>
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (what = "Not found") => new HttpError(404, "not_found", what);
