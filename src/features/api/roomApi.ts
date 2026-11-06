import { baseApi } from './baseApi';
import type {
  CreateRoomPayload,
  Room,
  UpdateRoomStatusPayload,
} from '../../types/api';

export const roomApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listRooms: builder.query<Room[], string>({
      query: (hostelId) => ({
        url: `/hostels/${hostelId}/rooms`,
        method: 'GET',
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: 'Room' as const, id: _id })),
              { type: 'Room' as const, id: 'LIST' },
            ]
          : [{ type: 'Room' as const, id: 'LIST' }],
    }),
    getRoomById: builder.query<Room, string>({
      query: (id) => ({
        url: `/rooms/${id}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, id) => [{ type: 'Room', id }],
    }),
    createRoom: builder.mutation<Room, { hostelId: string; data: CreateRoomPayload }>({
      query: ({ hostelId, data }) => ({
        url: `/hostels/${hostelId}/rooms`,
        method: 'POST',
        data,
      }),
      invalidatesTags: [{ type: 'Room', id: 'LIST' }, 'DashboardSummary'],
    }),
    updateRoom: builder.mutation<Room, { id: string; data: Partial<Room> }>({
      query: ({ id, data }) => ({
        url: `/rooms/${id}`,
        method: 'PUT',
        data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Room', id },
        { type: 'Room', id: 'LIST' },
        'DashboardSummary',
      ],
    }),
    updateRoomStatus: builder.mutation<Room, { id: string; data: UpdateRoomStatusPayload }>({
      query: ({ id, data }) => ({
        url: `/rooms/${id}/status`,
        method: 'PATCH',
        data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Room', id },
        { type: 'Room', id: 'LIST' },
        'DashboardSummary',
      ],
    }),
    deleteRoom: builder.mutation<void, string>({
      query: (id) => ({
        url: `/rooms/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Room', id: 'LIST' }, 'DashboardSummary'],
    }),
  }),
});

export const {
  useListRoomsQuery,
  useGetRoomByIdQuery,
  useCreateRoomMutation,
  useUpdateRoomMutation,
  useUpdateRoomStatusMutation,
  useDeleteRoomMutation,
} = roomApi;
