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

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ErrorBody | null;
  return new ApiError(
    res.status,
    body?.error?.code ?? "error",
    body?.error?.message ?? "Something went wrong.",
    body?.error?.details
  );
}

type Options = Omit<RequestInit, "body"> & { json?: unknown };

// Browser calls go to this site's /api, which forwards them to the API.
export async function apiFetch<T>(path: string, { json, headers, ...init }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { ...(json !== undefined && { "content-type": "application/json" }), ...headers },
      ...(json !== undefined && { body: JSON.stringify(json) }),
    });
  } catch {
    throw new ApiError(0, "network_error", "Could not reach the store. Check your connection and try again.");
  }

  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}
