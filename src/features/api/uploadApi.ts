import { baseApi } from './baseApi';

export interface UploadSingleResponse {
  url: string;
  name: string;
  fileId: string;
  isSimulated?: boolean;
}

export interface UploadMultipleResponse {
  urls: string[];
  files: UploadSingleResponse[];
}

export const uploadApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    uploadImage: builder.mutation<UploadSingleResponse, FormData>({
      query: (formData) => ({
        url: '/upload/image',
        method: 'POST',
        data: formData,
      }),
    }),
    uploadImages: builder.mutation<UploadMultipleResponse, FormData>({
      query: (formData) => ({
        url: '/upload/images',
        method: 'POST',
        data: formData,
      }),
    }),
  }),
});

export const { useUploadImageMutation, useUploadImagesMutation } = uploadApi;

