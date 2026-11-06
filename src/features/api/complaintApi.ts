import { baseApi } from './baseApi';
import type { Complaint, ComplaintStatus, SeverityTier } from '../../types/api';

export interface ComplaintFilterParams {
  status?: ComplaintStatus;
  severityTier?: SeverityTier;
}

export const complaintApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listComplaints: builder.query<Complaint[], ComplaintFilterParams | void>({
      query: (params) => ({
        url: '/complaints',
        method: 'GET',
        params: params || undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: 'Complaint' as const, id: _id })),
              { type: 'Complaint' as const, id: 'LIST' },
            ]
          : [{ type: 'Complaint' as const, id: 'LIST' }],
    }),
    getComplaintById: builder.query<Complaint, string>({
      query: (id) => ({
        url: `/complaints/${id}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, id) => [{ type: 'Complaint', id }],
    }),
    assignComplaint: builder.mutation<Complaint, { id: string; staffId: string }>({
      query: ({ id, staffId }) => ({
        url: `/complaints/${id}/assign`,
        method: 'PATCH',
        data: { staffId },
      }),
      invalidatesTags: [
        { type: 'Complaint', id: 'LIST' },
        'DashboardSummary',
      ],
    }),
    updateComplaintStatus: builder.mutation<Complaint, { id: string; status: ComplaintStatus }>({
      query: ({ id, status }) => ({
        url: `/complaints/${id}/status`,
        method: 'PATCH',
        data: { status },
      }),
      invalidatesTags: [
        { type: 'Complaint', id: 'LIST' },
        'DashboardSummary',
      ],
    }),
  }),
});

export const {
  useListComplaintsQuery,
  useGetComplaintByIdQuery,
  useAssignComplaintMutation,
  useUpdateComplaintStatusMutation,
} = complaintApi;
