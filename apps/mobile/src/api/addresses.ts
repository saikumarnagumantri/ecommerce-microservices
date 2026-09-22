import { apiClient } from './client';
import { Address } from './types';

export const listAddresses = (): Promise<Address[]> => apiClient.get('/me/addresses').then((r) => r.data);

export interface AddressInput {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export const addAddress = (input: AddressInput): Promise<Address> =>
  apiClient.post('/me/addresses', input).then((r) => r.data);
