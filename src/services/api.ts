import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";

declare module "axios" {
  export interface AxiosRequestConfig {
    /** When set, identical in-flight GET/POST requests share one Promise. */
    dedupeKey?: string;
    /** Skip deduplication for this request. */
    skipDedupe?: boolean;
    /** Per-request retry count override (default 0 — no client retries except via backoff helper). */
    retryCount?: number;
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfter?: number;

  constructor(message: string, status: number, code?: string, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

interface InflightEntry {
  promise: Promise<unknown>;
  abortController: AbortController;
}

const inflightRequests = new Map<string, InflightEntry>();
const loggedErrors = new Map<string, number>();
const ERROR_LOG_COOLDOWN_MS = 10000;

function shouldLogError(key: string): boolean {
  const last = loggedErrors.get(key) ?? 0;
  if (Date.now() - last < ERROR_LOG_COOLDOWN_MS) return false;
  loggedErrors.set(key, Date.now());
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableClientError(error: AxiosError): boolean {
  const status = error.response?.status;
  if (!status) return true;
  if (status === 429 || status === 503) return true;
  if (status >= 400 && status < 500) return false;
  return status >= 500;
}

function getRetryAfterMs(error: AxiosError): number | undefined {
  const header = error.response?.headers?.["retry-after"];
  if (header) {
    const seconds = parseInt(String(header), 10);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  const body = error.response?.data as { error?: { retryAfter?: number } } | undefined;
  if (body?.error?.retryAfter) return body.error.retryAfter * 1000;
  return undefined;
}

export const api = axios.create({
  baseURL: "",
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("crunch_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const match = document.cookie.match(/(^|;)\s*_csrf\s*=\s*([^;]+)/);
    const csrfToken = match ? match[2] : null;
    if (csrfToken && config.headers) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const { status, data } = error.response;
      const payload = data as { error?: { message?: string; code?: number; retryAfter?: number } };

      if (status === 401) {
        if (shouldLogError("401")) {
          console.warn("[API] Unauthorized — token may be expired.");
        }
        localStorage.removeItem("crunch_token");
        localStorage.removeItem("crunch_user");
      } else if (status === 403) {
        if (shouldLogError("403")) {
          console.warn("[API] Access forbidden.");
        }
      } else if (status >= 500 && shouldLogError(`5xx:${error.config?.url}`)) {
        console.error(`[API] Server error ${status} on ${error.config?.url}`);
      }

      return Promise.reject(
        new ApiError(
          payload?.error?.message || error.message,
          status,
          String(payload?.error?.code ?? status),
          payload?.error?.retryAfter
        )
      );
    }

    if (error.request && shouldLogError("network")) {
      console.error("[API] Network error — unable to reach server.");
    }

    return Promise.reject(error);
  }
);

async function executeWithRetry<T>(
  config: AxiosRequestConfig,
  maxRetries: number
): Promise<T> {
  let attempt = 0;
  let delay = 1000;

  while (true) {
    attempt++;
    try {
      const response = await axios.request<T>({ ...config, ...(config.signal ? { signal: config.signal } : {}) });
      return response as unknown as T;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.name === "CanceledError" || axiosErr.code === "ERR_CANCELED") {
        throw err;
      }

      const retryable = isRetryableClientError(axiosErr);
      if (!retryable || attempt >= maxRetries) {
        throw err;
      }

      const retryAfter = getRetryAfterMs(axiosErr);
      const waitMs = retryAfter ?? delay * (0.5 + Math.random());
      await sleep(waitMs);
      delay *= 2;
    }
  }
}

const originalRequest = api.request.bind(api) as typeof api.request;

export async function dedupedRequest<T>(
  config: AxiosRequestConfig & { dedupeKey: string }
): Promise<{ data: T; status: number; headers: Record<string, string> }> {
  const key = config.dedupeKey;

  const existing = inflightRequests.get(key);
  if (existing && !config.signal?.aborted) {
    const result = await existing.promise;
    return result as { data: T; status: number; headers: Record<string, string> };
  }

  const abortController = new AbortController();

  if (config.signal) {
    if (config.signal.aborted) {
      abortController.abort();
    } else {
      config.signal.addEventListener("abort", () => abortController.abort(), { once: true });
    }
  }

  const promise = originalRequest({ ...config, signal: abortController.signal, skipDedupe: true })
    .then((res) => ({ data: res.data as T, status: res.status, headers: res.headers as Record<string, string> }))
    .finally(() => {
      inflightRequests.delete(key);
    });

  inflightRequests.set(key, { promise, abortController });
  return promise as Promise<{ data: T; status: number; headers: Record<string, string> }>;
}

const requestWithDedupe = function (config: AxiosRequestConfig) {
  const dedupeKey = config.dedupeKey;
  const skipDedupe = config.skipDedupe;

  if (dedupeKey && !skipDedupe) {
    return dedupedRequest({ ...config, dedupeKey }).then((result) => ({
      data: result.data,
      status: result.status,
      statusText: "",
      headers: result.headers,
      config: config as InternalAxiosRequestConfig,
    }));
  }

  const retries = config.retryCount ?? 0;
  if (retries > 0) {
    return executeWithRetry(config, retries + 1);
  }

  return originalRequest(config);
};

api.request = requestWithDedupe as typeof api.request;

export default api;
