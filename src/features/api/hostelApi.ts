import { baseApi } from './baseApi';
import type {
  ChatbotInfo,
  CreateHostelPayload,
  Hostel,
} from '../../types/api';

export const hostelApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getHostelById: builder.query<Hostel, string>({
      query: (id) => ({
        url: `/hostels/${id}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, id) => [{ type: 'Hostel', id }],
    }),
    createHostel: builder.mutation<Hostel, CreateHostelPayload>({
      query: (payload) => ({
        url: '/hostels',
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: ['Hostel', 'User', 'DashboardSummary'],
    }),
    updateHostel: builder.mutation<Hostel, { id: string; data: Partial<Hostel> }>({
      query: ({ id, data }) => ({
        url: `/hostels/${id}`,
        method: 'PUT',
        data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Hostel', id },
        'Hostel',
        'DashboardSummary',
      ],
    }),
    publishHostel: builder.mutation<Hostel, string>({
      query: (id) => ({ url: `/hostels/${id}/publish`, method: 'POST', data: {} }),
      invalidatesTags: ['Hostel', 'DashboardSummary'],
    }),
    getChatbotInfo: builder.query<ChatbotInfo, string>({
      query: (hostelId) => ({
        url: `/hostels/${hostelId}/chatbot-info`,
        method: 'GET',
      }),
      providesTags: (_result, _error, hostelId) => [
        { type: 'Hostel', id: `chatbot-${hostelId}` },
      ],
    }),
    updateChatbotInfo: builder.mutation<ChatbotInfo, { hostelId: string; data: Partial<ChatbotInfo> }>({
      query: ({ hostelId, data }) => ({
        url: `/hostels/${hostelId}/chatbot-info`,
        method: 'PUT',
        data,
      }),
      invalidatesTags: (_result, _error, { hostelId }) => [
        { type: 'Hostel', id: `chatbot-${hostelId}` },
        { type: 'Hostel', id: hostelId },
      ],
    }),
    getStripeOnboardLink: builder.query<{ url: string }, string>({
      query: (hostelId) => ({
        url: `/hostels/${hostelId}/stripe/onboard`,
        method: 'GET',
      }),
    }),
    getStripeStatus: builder.query<
      {
        connected: boolean;
        isConnected: boolean;
        onboardingComplete: boolean;
        stripeAccountId: string | null;
        detailsSubmitted: boolean;
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
        capabilities?: {
          transfers?: string | null;
          card_payments?: string | null;
        };
        requirementsPending: boolean;
        currentlyDue?: string[];
        disabledReason?: string | null;
      },
      string
    >({
      query: (hostelId) => ({
        url: `/hostels/${hostelId}/stripe/status`,
        method: 'GET',
      }),
      providesTags: (_result, _error, hostelId) => [
        { type: 'Hostel', id: `stripe-${hostelId}` },
      ],
    }),
  }),
});

export const {
  useGetHostelByIdQuery,
  useCreateHostelMutation,
  useUpdateHostelMutation,
  usePublishHostelMutation,
  useGetChatbotInfoQuery,
  useUpdateChatbotInfoMutation,
  useLazyGetStripeOnboardLinkQuery,
  useGetStripeStatusQuery,
  useLazyGetStripeStatusQuery,
} = hostelApi;
