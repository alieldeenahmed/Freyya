export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// What the caller can rely on, however the request failed. The API's own errors keep their
// code. Everything else is one of these, so no screen needs to guess from a status number.
export const UNAVAILABLE = "unavailable";
export const NETWORK_ERROR = "network_error";
export const TIMEOUT = "timeout";

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ErrorBody | null;

  if (body?.error?.code) {
    return new ApiError(res.status, body.error.code, body.error.message ?? "Something went wrong.", body.error.details);
  }

  // No error from the API. When the API itself is down, the storefront's own server answers
  // in its place with a plain 5xx, and that is not something the shopper did.
  if (res.status >= 500) {
    return new ApiError(
      res.status,
      UNAVAILABLE,
      "The store is not answering right now. Please try again in a moment."
    );
  }
  return new ApiError(res.status, "error", "Something went wrong.");
}

type Options = Omit<RequestInit, "body"> & {
  json?: unknown;
  // How long to wait before giving up. Long enough for a slow phone connection, short enough
  // that the page does not seem frozen.
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

// Browser calls go to this site's /api, which forwards them to the API.
export async function apiFetch<T>(
  path: string,
  { json, headers, timeoutMs = DEFAULT_TIMEOUT_MS, ...init }: Options = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { ...(json !== undefined && { "content-type": "application/json" }), ...headers },
      ...(json !== undefined && { body: JSON.stringify(json) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError(0, TIMEOUT, "The store took too long to answer. Please try again.");
    }
    throw new ApiError(0, NETWORK_ERROR, "Could not reach the store. Check your connection and try again.");
  }

  if (!res.ok) {
    const error = await toApiError(res);
    // An admin whose session ended goes back to sign in, instead of reading "Sign in to continue".
    if (
      error.status === 401 &&
      path.startsWith("/admin") &&
      path !== "/admin/login" &&
      typeof window !== "undefined"
    ) {
      // A full page load on purpose: the session is gone, so nothing on this page should stay.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/admin/login";
    }
    throw error;
  }

  try {
    return (await res.json()) as T;
  } catch {
    // A success whose body is not JSON: something in between answered, not the API.
    throw new ApiError(res.status, UNAVAILABLE, "The store sent an answer we could not read. Please try again.");
  }
}
