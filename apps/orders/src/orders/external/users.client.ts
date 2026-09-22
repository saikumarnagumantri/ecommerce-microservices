import axios from 'axios';
import { INTERNAL_KEY_HEADER } from '@salescart/common';

const USERS_URL = process.env.USERS_URL ?? 'http://localhost:3006';

export interface AddressSnapshot {
  id: number;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/** Resolves one of the calling user's own addresses — 404s (via the forwarded error) if it isn't theirs. */
export const getAddress = async (addressId: number, authHeader: string): Promise<AddressSnapshot> => {
  const res = await axios.get(`${USERS_URL}/me/addresses/${addressId}`, {
    headers: { authorization: authHeader, [INTERNAL_KEY_HEADER]: process.env.INTERNAL_API_KEY ?? '' },
  });
  return res.data;
};
