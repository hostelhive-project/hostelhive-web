import { createApi } from '@reduxjs/toolkit/query/react';
import type { BaseQueryApi, BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosRequestConfig, AxiosError } from 'axios';
import axios from 'axios';
import { logOut } from '../auth/authSlice';

export interface AxiosBaseQueryArgs {
  url: string;
  method?: AxiosRequestConfig['method'];
  data?: AxiosRequestConfig['data'];
  params?: AxiosRequestConfig['params'];
  headers?: AxiosRequestConfig['headers'];
}

export interface AxiosBaseQueryError {
  status?: number;
  message: string;
  data?: unknown;
}

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
type AuthStorage = Storage;
const refreshOperations = new WeakMap<AuthStorage, Promise<string | null>>();

function getAuthStorage(): AuthStorage | null {
  if (localStorage.getItem('refreshToken') || localStorage.getItem('token')) return localStorage;
  if (sessionStorage.getItem('refreshToken') || sessionStorage.getItem('token')) return sessionStorage;
  return null;
}

function clearAuth(api: BaseQueryApi) {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem('user');
    storage.removeItem('token');
    storage.removeItem('refreshToken');
  }
  api.dispatch(logOut());
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

function isAuthEndpoint(url: string) {
  return [
    '/auth/login',
    '/auth/register',
    '/auth/verify-email',
    '/auth/resend-verification',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/refresh',
  ].some((endpoint) => url.startsWith(endpoint));
}

function errorFromAxios(axiosError: unknown): AxiosBaseQueryError {
  const err = axiosError as AxiosError<{ message?: string }>;
  return {
    status: err.response?.status,
    message: err.response?.data?.message || err.message || 'An error occurred',
    data: err.response?.data,
  };
}

function unwrapResponse(data: unknown): unknown {
  if (data && typeof data === 'object' && 'data' in data) {
    return (data as { data: unknown }).data;
  }
  return data;
}

async function sendRequest(args: AxiosBaseQueryArgs, tokenOverride?: string | null) {
  const token = tokenOverride === undefined ? getAuthStorage()?.getItem('token') : tokenOverride;
  const headersToSend: Record<string, any> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(args.headers as Record<string, unknown> | undefined),
  };
  const isFormData = typeof FormData !== 'undefined' && args.data instanceof FormData;
  if (!isFormData && !headersToSend['Content-Type']) {
    headersToSend['Content-Type'] = 'application/json';
  }

  const result = await axios({
    url: baseUrl + args.url,
    method: args.method || 'GET',
    data: args.data,
    params: args.params,
    headers: headersToSend as AxiosRequestConfig['headers'],
  });
  return unwrapResponse(result.data);
}

async function refreshSession(storage: AuthStorage, api: BaseQueryApi): Promise<string | null> {
  const pending = refreshOperations.get(storage);
  if (pending) return pending;
  const refreshToken = storage.getItem('refreshToken');
  const performRefresh = async () => {
    if (storage.getItem('refreshToken') !== refreshToken) return storage.getItem('token');
    if (!refreshToken) { clearAuth(api); return null; }
    try {
      const response = await axios.post(`${baseUrl}/auth/refresh`, { refreshToken }, { timeout: 20000 });
      // Avoid restoring credentials after sign-out or a different sign-in.
      if (storage.getItem('refreshToken') !== refreshToken) return storage.getItem('token');
      const tokens = unwrapResponse(response.data) as { accessToken?: string; refreshToken?: string };
      if (!tokens?.accessToken) return null;
      storage.setItem('token', tokens.accessToken);
      storage.setItem('refreshToken', tokens.refreshToken || refreshToken);
      return tokens.accessToken;
    } catch (error) {
      if (errorFromAxios(error).status === 401 && storage.getItem('refreshToken') === refreshToken) clearAuth(api);
      // Keep sessions on network/5xx failures; only an explicit 401 revokes them.
      throw error;
    }
  };
  // Coordinate tabs sharing localStorage as well as parallel requests in one tab.
  const operation = typeof navigator !== 'undefined' && navigator.locks?.request
    ? navigator.locks.request('hostelhive-session-refresh', performRefresh)
    : performRefresh();
  refreshOperations.set(storage, operation);
  try { return await operation; }
  finally { if (refreshOperations.get(storage) === operation) refreshOperations.delete(storage); }
}

export const axiosBaseQuery =
  (): BaseQueryFn<AxiosBaseQueryArgs, unknown, AxiosBaseQueryError> =>
  async (args, api) => {
    const rejectedToken = getAuthStorage()?.getItem('token') || null;
    try {
      const data = await sendRequest(args, rejectedToken);
      return { data };
    } catch (axiosError) {
      const firstError = errorFromAxios(axiosError);
      if (firstError.status !== 401 || isAuthEndpoint(args.url)) {
        return { error: firstError };
      }

      const storage = getAuthStorage();
      const refreshToken = storage?.getItem('refreshToken');
      if (!storage || !refreshToken) {
        clearAuth(api);
        return { error: firstError };
      }

      try {
        // A late 401 may belong to the token another request just replaced.
        const currentToken = storage.getItem('token');
        const token = currentToken && currentToken !== rejectedToken ? currentToken : await refreshSession(storage, api);
        if (!token) return { error: firstError };
        const data = await sendRequest(args, token);
        return { data };
      } catch (refreshError) {
        return { error: errorFromAxios(refreshError) };
      }
    }
  };

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery(),
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: [
    'Notification',
    'Hostel',
    'Room',
    'Booking',
    'Invoice',
    'Payment',
    'Complaint',
    'Task',
    'DashboardSummary',
    'User',
  ],
  endpoints: () => ({}),
});
