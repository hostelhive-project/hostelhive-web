import { baseApi } from './baseApi';
import type { BlockchainVerifyResponse } from '../../types/api';

export const blockchainApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    verifyRecord: builder.query<
      BlockchainVerifyResponse,
      { sourceType: 'Payment' | 'Complaint'; sourceId: string }
    >({
      query: ({ sourceType, sourceId }) => ({
        url: `/blockchain/${sourceType}/${sourceId}/verify`,
        method: 'GET',
      }),
    }),
  }),
});

export const {
  useVerifyRecordQuery,
  useLazyVerifyRecordQuery,
} = blockchainApi;
