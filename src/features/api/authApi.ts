import { baseApi } from './baseApi';
import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  RegistrationPendingResponse,
} from '../../types/api';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, LoginPayload>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        data: credentials,
      }),
      invalidatesTags: ['User', 'DashboardSummary'],
    }),
    register: builder.mutation<RegistrationPendingResponse, RegisterPayload>({
      query: (userData) => ({
        url: '/auth/register',
        method: 'POST',
        data: userData,
      }),
      invalidatesTags: ['User', 'DashboardSummary'],
    }),
    verifyEmail: builder.mutation<AuthResponse, { email: string; otp: string }>({
      query: (body) => ({
        url: '/auth/verify-email',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: ['User', 'DashboardSummary'],
    }),
    resendVerification: builder.mutation<void, { email: string }>({
      query: (body) => ({
        url: '/auth/resend-verification',
        method: 'POST',
        data: body,
      }),
    }),
    requestPasswordReset: builder.mutation<void, { email: string }>({
      query: (body) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        data: body,
      }),
    }),
    resetPassword: builder.mutation<void, { email: string; otp: string; newPassword: string }>({
      query: (body) => ({
        url: '/auth/reset-password',
        method: 'POST',
        data: body,
      }),
    }),
    changePassword: builder.mutation<void, { currentPassword: string; newPassword: string }>({
      query: (body) => ({
        url: '/auth/change-password',
        method: 'POST',
        data: body,
      }),
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useRequestPasswordResetMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
} = authApi;
