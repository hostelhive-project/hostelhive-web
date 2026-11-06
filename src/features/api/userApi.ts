import { baseApi } from './baseApi';
import type { CreateStaffPayload, UpdateStaffPayload, User } from '../../types/api';

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUserById: builder.query<User, string>({
      query: (id) => ({
        url: `/users/${id}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, id) => [{ type: 'User', id }],
    }),
    updateProfile: builder.mutation<User, { id: string; data: Partial<User> }>({
      query: ({ id, data }) => ({
        url: `/users/${id}`,
        method: 'PUT',
        data,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'User', id }, 'User'],
    }),
    listStaffForHostel: builder.query<User[], string>({
      query: (hostelId) => ({
        url: `/users/hostel/${hostelId}/staff`,
        method: 'GET',
      }),
      providesTags: ['User'],
    }),
    createStaff: builder.mutation<User, CreateStaffPayload>({
      query: (data) => ({
        url: '/users/staff',
        method: 'POST',
        data,
      }),
      invalidatesTags: ['User'],
    }),
    updateStaff: builder.mutation<User, { id: string; data: UpdateStaffPayload }>({
      query: ({ id, data }) => ({
        url: `/users/staff/${id}`,
        method: 'PATCH',
        data,
      }),
      invalidatesTags: ['User'],
    }),
    updateStaffInvitation: builder.mutation<User, { id: string; email: string }>({
      query: ({ id, email }) => ({
        url: `/users/staff/${id}/invitation`,
        method: 'PATCH',
        data: { email },
      }),
      invalidatesTags: ['User'],
    }),
    resendStaffInvitation: builder.mutation<null, string>({
      query: (id) => ({
        url: `/users/staff/${id}/invitation/resend`,
        method: 'POST',
      }),
      invalidatesTags: ['User'],
    }),
    cancelStaffInvitation: builder.mutation<null, string>({
      query: (id) => ({
        url: `/users/staff/${id}/invitation`,
        method: 'DELETE',
      }),
      invalidatesTags: ['User'],
    }),
    deleteStaff: builder.mutation<User, string>({
      query: (id) => ({
        url: `/users/staff/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useGetUserByIdQuery,
  useUpdateProfileMutation,
  useListStaffForHostelQuery,
  useCreateStaffMutation,
  useUpdateStaffMutation,
  useUpdateStaffInvitationMutation,
  useResendStaffInvitationMutation,
  useCancelStaffInvitationMutation,
  useDeleteStaffMutation,
} = userApi;
