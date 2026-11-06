import { baseApi } from './baseApi';
import type {
  CleaningDirectiveResponse,
  BroadcastDirectiveResponse,
  CleaningTask,
  TaskStatus,
  TaskType,
} from '../../types/api';

export interface AssignCleaningTaskPayload {
  roomId: string;
  assignedStaffId: string;
  taskType: TaskType;
  scheduledTime: string;
}

export const taskApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listCleaningTasksForHostel: builder.query<
      CleaningTask[],
      { hostelId: string; statusFilter?: TaskStatus }
    >({
      query: ({ hostelId, statusFilter }) => ({
        url: `/cleaning-tasks/hostel/${hostelId}`,
        method: 'GET',
        params: statusFilter ? { status: statusFilter } : undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: 'Task' as const, id: _id })),
              { type: 'Task' as const, id: 'LIST' },
            ]
          : [{ type: 'Task' as const, id: 'LIST' }],
    }),
    getCleaningTaskById: builder.query<CleaningTask, string>({
      query: (id) => ({
        url: `/cleaning-tasks/${id}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, id) => [{ type: 'Task', id }],
    }),
    assignCleaningTask: builder.mutation<CleaningTask, AssignCleaningTaskPayload>({
      query: (payload) => ({
        url: '/cleaning-tasks',
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: [{ type: 'Task', id: 'LIST' }, 'DashboardSummary'],
    }),
    getCleaningDirective: builder.query<CleaningDirectiveResponse, void>({
      query: () => ({
        url: '/cleaning-tasks/directive',
        method: 'GET',
      }),
      providesTags: [{ type: 'Task', id: 'DIRECTIVE' }],
    }),
    broadcastCleaningDirective: builder.mutation<
      BroadcastDirectiveResponse,
      { directive: string }
    >({
      query: (payload) => ({
        url: '/cleaning-tasks/directive',
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: [{ type: 'Task', id: 'DIRECTIVE' }],
    }),
  }),
});

export const {
  useListCleaningTasksForHostelQuery,
  useGetCleaningTaskByIdQuery,
  useAssignCleaningTaskMutation,
  useGetCleaningDirectiveQuery,
  useBroadcastCleaningDirectiveMutation,
} = taskApi;
