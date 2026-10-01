import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { UserStatus } from '../../../../generated/prisma/enums.js';
import { PrismaService } from '../../../../infrastructure/database/prisma.service.js';

import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();

    const authorization =
      request.headers.authorization;

    /*
     * Expected:
     *
     * Authorization: Bearer <access-token>
     */
    if (!authorization) {
      throw new UnauthorizedException(
        'Access token is missing.',
      );
    }

    const [scheme, token] =
      authorization.split(' ');

    if (
      scheme !== 'Bearer' ||
      !token
    ) {
      throw new UnauthorizedException(
        'Invalid authorization header.',
      );
    }

    let payload: JwtPayload;

    try {
      payload =
        await this.jwtService.verifyAsync<JwtPayload>(
          token,
        );
    } catch {
      throw new UnauthorizedException(
        'Access token is invalid or expired.',
      );
    }

    /*
     * Access token must contain both:
     *
     * sub -> user ID
     * sid -> AuthSession ID
     */
    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedException(
        'Invalid access token.',
      );
    }

    /*
     * Verify that the session still exists.
     *
     * This allows logout/session revocation to also
     * invalidate existing access tokens immediately.
     */
    const session =
      await this.prisma.authSession.findUnique({
        where: {
          id: payload.sid,
        },

        select: {
          id: true,
          userId: true,
          revokedAt: true,
          expiresAt: true,

          user: {
            select: {
              status: true,
              emailVerifiedAt: true,
            },
          },
        },
      });

    if (!session) {
      throw new UnauthorizedException(
        'Authentication session does not exist.',
      );
    }

    /*
     * Prevent using a session belonging
     * to another user.
     */
    if (session.userId !== payload.sub) {
      throw new UnauthorizedException(
        'Invalid authentication session.',
      );
    }

    /*
     * Logout revokes the AuthSession.
     */
    if (session.revokedAt) {
      throw new UnauthorizedException(
        'Authentication session has been revoked.',
      );
    }

    /*
     * AuthSession expiration corresponds to the
     * lifetime of the refreshable login session.
     */
    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Authentication session has expired.',
      );
    }

    /*
     * Account must still be verified and active.
     */
    if (
      session.user.status !==
        UserStatus.ACTIVE ||
      !session.user.emailVerifiedAt
    ) {
      throw new UnauthorizedException(
        'This account is not currently allowed to authenticate.',
      );
    }

    /*
     * Attach trusted authentication context
     * to the request.
     *
     * Downstream controllers do not need to decode
     * the JWT again.
     */
    request.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
    };

    return true;
  }
}
