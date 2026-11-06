import { baseApi } from './baseApi';

export interface AdminNotification { _id: string; title: string; body: string; type: string; relatedEntityId?: string; isRead: boolean; createdAt: string }
export const notificationApi = baseApi.injectEndpoints({ endpoints: (builder) => ({
  listAdminNotifications: builder.query<AdminNotification[], void>({ query: () => ({ url: '/notifications', method: 'GET' }), providesTags: ['Notification'] }),
  adminUnreadCount: builder.query<{ count: number }, void>({ query: () => ({ url: '/notifications/unread-count', method: 'GET' }), providesTags: ['Notification'] }),
  readAdminNotification: builder.mutation<AdminNotification, string>({ query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }), invalidatesTags: ['Notification'] }),
  readAllAdminNotifications: builder.mutation<void, void>({ query: () => ({ url: '/notifications/read-all', method: 'PATCH' }), invalidatesTags: ['Notification'] }),
}) });
export const { useListAdminNotificationsQuery, useAdminUnreadCountQuery, useReadAdminNotificationMutation, useReadAllAdminNotificationsMutation } = notificationApi;
