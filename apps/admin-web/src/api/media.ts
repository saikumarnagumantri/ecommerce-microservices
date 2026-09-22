import { apiClient } from './client';
import { UploadResponse } from './types';

export const uploadFile = (file: File): Promise<UploadResponse> => {
  const form = new FormData();
  form.append('file', file);
  return apiClient.post('/upload', form).then((r) => r.data);
};
