import { baseApi } from './baseApi';
import type { Payment } from '../../types/api';

export const paymentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listPaymentsForInvoice: builder.query<Payment[], string>({
      query: (invoiceId) => ({ url: `/payments/invoice/${invoiceId}`, method: 'GET' }),
      providesTags: (payments) => payments
        ? [...payments.map(({ _id }) => ({ type: 'Payment' as const, id: _id })), { type: 'Payment', id: 'LIST' }]
        : [{ type: 'Payment', id: 'LIST' }],
    }),
  }),
});

export const { useListPaymentsForInvoiceQuery } = paymentApi;
