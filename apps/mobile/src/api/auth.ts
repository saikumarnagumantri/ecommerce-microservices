import { apiClient } from './client';
import { AuthResponse, UserProfile } from './types';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export const register = (input: RegisterInput): Promise<UserProfile> =>
  apiClient.post('/auth/register', input).then((r) => r.data);

export const login = (email: string, password: string): Promise<AuthResponse> =>
  apiClient.post('/auth/login', { email, password }).then((r) => r.data);

export const getProfile = (): Promise<UserProfile> => apiClient.get('/me').then((r) => r.data);

export const updateProfile = (input: { name?: string; phone?: string }): Promise<UserProfile> =>
  apiClient.patch('/me', input).then((r) => r.data);
