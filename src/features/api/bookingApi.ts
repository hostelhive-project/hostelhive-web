import { baseApi } from './baseApi';
import type { Booking } from '../../types/api';

export const bookingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listPendingBookings: builder.query<Booking[], string>({
      query: (hostelId) => ({
        url: `/bookings/hostel/${hostelId}/pending`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Booking' as const, id: 'LIST' }],
    }),
    listApprovedBookings: builder.query<Booking[], string>({
      query: (hostelId) => ({
        url: `/bookings/hostel/${hostelId}?status=Approved`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Booking' as const, id: 'LIST' }],
    }),
    listResidentsForHostel: builder.query<Booking[], string>({
      query: (hostelId) => ({
        url: `/bookings/hostel/${hostelId}/residents`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Booking' as const, id: 'LIST' }],
    }),
    approveBooking: builder.mutation<Booking, string>({
      query: (id) => ({
        url: `/bookings/${id}/approve`,
        method: 'PATCH',
      }),
      invalidatesTags: [
        { type: 'Booking', id: 'LIST' },
        'Room',
        'DashboardSummary',
      ],
    }),
    rejectBooking: builder.mutation<Booking, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/bookings/${id}/reject`,
        method: 'PATCH',
        data: { reason },
      }),
      invalidatesTags: [
        { type: 'Booking', id: 'LIST' },
        'Room',
        'DashboardSummary',
      ],
    }),
    checkInBooking: builder.mutation<Booking, string>({
      query: (id) => ({
        url: `/bookings/${id}/checkin`,
        method: 'PATCH',
      }),
      invalidatesTags: [
        { type: 'Booking', id: 'LIST' },
        'Room',
        'Invoice',
        'DashboardSummary',
      ],
    }),
    checkOutBooking: builder.mutation<Booking, string>({
      query: (id) => ({
        url: `/bookings/${id}/checkout`,
        method: 'PATCH',
      }),
      invalidatesTags: [
        { type: 'Booking', id: 'LIST' },
        'Room',
        'DashboardSummary',
      ],
    }),
  }),
});

export const {
  useListPendingBookingsQuery,
  useListApprovedBookingsQuery,
  useListResidentsForHostelQuery,
  useApproveBookingMutation,
  useRejectBookingMutation,
  useCheckInBookingMutation,
  useCheckOutBookingMutation,
} = bookingApi;
