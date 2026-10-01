import type { Request } from 'express';

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  auth: AuthenticatedUser;
}
