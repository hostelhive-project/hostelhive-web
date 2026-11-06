import { baseApi } from './baseApi';
import type {
  DashboardRecentActivity,
  DashboardSummary,
} from '../../types/api';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardSummary: builder.query<DashboardSummary, void>({
      query: () => ({
        url: '/admin/dashboard/summary',
        method: 'GET',
      }),
      providesTags: ['DashboardSummary'],
    }),
    getRecentActivity: builder.query<DashboardRecentActivity, number | void>({
      query: (limit) => ({
        url: '/admin/dashboard/recent-activity',
        method: 'GET',
        params: limit ? { limit } : undefined,
      }),
      providesTags: ['DashboardSummary'],
    }),
  }),
});

export const {
  useGetDashboardSummaryQuery,
  useGetRecentActivityQuery,
} = dashboardApi;
