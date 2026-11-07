interface RequestError {
  message?: string;
  data?: { message?: string };
}

/** Narrow an RTK Query/Axios rejection without assuming the thrown value's shape. */
export function getRequestError(error: unknown): RequestError {
  if (!error || typeof error !== 'object') return {};
  const candidate = error as Record<string, unknown>;
  const data = candidate.data && typeof candidate.data === 'object'
    ? candidate.data as Record<string, unknown>
    : undefined;
  return {
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
    data: data ? { message: typeof data.message === 'string' ? data.message : undefined } : undefined,
  };
}
