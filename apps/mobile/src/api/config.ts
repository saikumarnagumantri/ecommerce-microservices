/**
 * The gateway is the only base URL the app ever talks to (E6's whole
 * point). Override for a real device or Android emulator, where
 * "localhost" means the device itself, not your dev machine:
 * Android emulator -> http://10.0.2.2:3001/api
 * physical device  -> http://<your-machine-LAN-IP>:3001/api
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';
