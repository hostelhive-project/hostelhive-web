import { baseApi } from './baseApi';
import type { Invoice, InvoiceStatus } from '../../types/api';

export const invoiceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listInvoicesForHostel: builder.query<Invoice[], { hostelId: string; status?: InvoiceStatus }>({
      query: ({ hostelId, status }) => ({
        url: `/invoices/hostel/${hostelId}`,
        method: 'GET',
        params: status ? { status } : undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: 'Invoice' as const, id: _id })),
              { type: 'Invoice' as const, id: 'LIST' },
            ]
          : [{ type: 'Invoice' as const, id: 'LIST' }],
    }),
    markInvoicePaid: builder.mutation<Invoice, string>({
      query: (id) => ({
        url: `/invoices/${id}/mark-paid`,
        method: 'PATCH',
      }),
      invalidatesTags: [
        { type: 'Invoice', id: 'LIST' },
        'Payment',
        'DashboardSummary',
      ],
    }),
    generateInvoiceForBooking: builder.mutation<Invoice, string>({
      query: (bookingId) => ({
        url: `/invoices/booking/${bookingId}/generate`,
        method: 'POST',
      }),
      invalidatesTags: [
        { type: 'Invoice', id: 'LIST' },
        'DashboardSummary',
      ],
    }),
    generateAllInvoices: builder.mutation<
      Array<{ bookingId: string; invoiceId?: string; status: string; error?: string }>,
      { billingMonth?: string }
    >({
      query: (body) => ({
        url: '/invoices/generate-all',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [
        { type: 'Invoice', id: 'LIST' },
        'DashboardSummary',
      ],
    }),
  }),
});

export const {
  useListInvoicesForHostelQuery,
  useMarkInvoicePaidMutation,
  useGenerateInvoiceForBookingMutation,
  useGenerateAllInvoicesMutation,
} = invoiceApi;
