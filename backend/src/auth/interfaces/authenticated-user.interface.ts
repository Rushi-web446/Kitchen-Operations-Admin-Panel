import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: Role;
  driverId?: number;
  companyId?: number;
}