import { Role } from '../enums/role.enum';

export interface AuthenticatedUser {
  id: number;
  role: Role;
  email?: string;
}
