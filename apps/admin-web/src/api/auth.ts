import { apiClient } from './client';
import { AuthResponse, UserProfile } from './types';

export const login = (email: string, password: string): Promise<AuthResponse> =>
  apiClient.post('/auth/login', { email, password }).then((r) => r.data);

export const getProfile = (): Promise<UserProfile> => apiClient.get('/me').then((r) => r.data);
