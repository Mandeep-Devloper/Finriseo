interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  status: number;
}

/**
 * The frontend/backend cutover switch (CLAUDE.md §6.9 — incremental, reversible).
 *
 * Unset/empty  → `${''}/api/otp/verify` is a relative path, so the browser hits
 *                the Next.js route handlers in src/app/api/** exactly as before.
 *                This is the fallback and the default; nothing changes.
 * Set to e.g.  → absolute URL against the standalone Express service. Its routers
 * :4000          are mounted under the same /api/* paths, so the endpoint strings
 *                below never change — only where they resolve to.
 *
 * Reverting is removing the env var. There is no second code path to delete.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      // Required once API_BASE_URL is cross-origin: the session cookies are
      // httpOnly and first-party, and fetch drops them by default off-origin.
      // Harmless on the relative path (equivalent to the browser default).
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    const data = await response.json();
    if (!response.ok) {
      return { data: null, error: data.error ?? 'Something went wrong', status: response.status };
    }
    return { data, error: null, status: response.status };
  } catch {
    return { data: null, error: 'Network error. Check your connection.', status: 0 };
  }
}

export const apiClient = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
};
