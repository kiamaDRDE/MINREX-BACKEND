import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import * as argon2 from 'argon2';

import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
  UserStatus,
  VerificationTokenType,
} from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { MailService } from '../../../infrastructure/mail/mail.service.js';

import { RegisterDto } from './dto/register.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';

import { LoginDto } from './dto/login.dto.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | REGISTER
  |--------------------------------------------------------------------------
  */

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();

    /*
     * Email and username are the authentication identifiers
     * used during registration.
     */
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },

      select: {
        email: true,
        username: true,
      },
    });

    if (existingUser?.email === email) {
      throw new ConflictException(
        'An account already exists with this email address.',
      );
    }

    if (existingUser?.username === username) {
      throw new ConflictException('This username is already taken.');
    }

    /*
     * Hash password using Argon2id.
     */
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    /*
     * Generate email verification token.
     *
     * The raw token will only be sent through email.
     * Only its hash is persisted in PostgreSQL.
     */
    const rawVerificationToken = randomBytes(32).toString('hex');

    const tokenHash = this.hashToken(rawVerificationToken);

    const verificationExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

    /*
     * Create user, profile and verification token.
     */
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        passwordHash,

        profile: {
          create: {
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
          },
        },

        verificationTokens: {
          create: {
            type: VerificationTokenType.EMAIL_VERIFICATION,

            tokenHash,

            expiresAt: verificationExpiresAt,
          },
        },
      },

      select: {
        id: true,
        email: true,
        username: true,
        status: true,
        createdAt: true,

        profile: {
          select: {
            firstName: true,
            lastName: true,
            preferredLanguage: true,
          },
        },
      },
    });

    /*
     * Send email verification.
     *
     * Failure to send the email must not cancel
     * the database registration.
     *
     * The user can later request another verification
     * email using resend-verification.
     */
    try {
      await this.mailService.sendVerificationEmail({
        to: email,
        firstName: user.profile?.firstName ?? null,
        token: rawVerificationToken,
      });
    } catch (error) {
      this.logger.error(
        'Unable to send registration verification email.',
        error instanceof Error ? error.stack : undefined,
      );
    }

    return {
      user,

      verification: {
        required: true,
        channel: 'EMAIL',
        expiresAt: verificationExpiresAt,
      },
    };
  }

  /*
  |--------------------------------------------------------------------------
  | VERIFY EMAIL
  |--------------------------------------------------------------------------
  */

  async verifyEmail(dto: VerifyEmailDto) {
    const tokenHash = this.hashToken(dto.token);

    const now = new Date();

    /*
     * Search for a valid and unused verification token.
     */
    const verificationToken = await this.prisma.verificationToken.findFirst({
      where: {
        tokenHash,

        type: VerificationTokenType.EMAIL_VERIFICATION,

        consumedAt: null,

        expiresAt: {
          gt: now,
        },
      },

      select: {
        id: true,
        userId: true,

        user: {
          select: {
            status: true,
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (!verificationToken) {
      throw new BadRequestException(
        'Verification token is invalid or has expired.',
      );
    }

    /*
     * Defensive check.
     */
    if (verificationToken.user.emailVerifiedAt) {
      return {
        verified: true,
        message: 'Email address is already verified.',
      };
    }

    /*
     * Verification is performed atomically.
     *
     * - consume current token
     * - activate user
     * - invalidate other unused tokens
     */
    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: {
          id: verificationToken.id,
        },

        data: {
          consumedAt: now,
        },
      }),

      this.prisma.user.update({
        where: {
          id: verificationToken.userId,
        },

        data: {
          emailVerifiedAt: now,
          status: UserStatus.ACTIVE,
        },
      }),

      this.prisma.verificationToken.updateMany({
        where: {
          userId: verificationToken.userId,

          type: VerificationTokenType.EMAIL_VERIFICATION,

          consumedAt: null,

          id: {
            not: verificationToken.id,
          },
        },

        data: {
          consumedAt: now,
        },
      }),
    ]);

    return {
      verified: true,
      message: 'Email address verified successfully.',
    };
  }

  /*
  |--------------------------------------------------------------------------
  | RESEND EMAIL VERIFICATION
  |--------------------------------------------------------------------------
  */

  async resendVerification(dto: ResendVerificationDto) {
    const email = dto.email.trim().toLowerCase();

    /*
     * Generic response prevents account enumeration.
     */
    const genericResponse = {
      message:
        'If the account exists and requires verification, a new verification email will be sent.',
    };

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },

      select: {
        id: true,
        email: true,
        status: true,
        emailVerifiedAt: true,

        profile: {
          select: {
            firstName: true,
          },
        },
      },
    });

    /*
     * Do not reveal:
     *
     * - whether the email exists
     * - whether the email is already verified
     * - whether the account is active
     */
    if (
      !user ||
      user.emailVerifiedAt ||
      user.status !== UserStatus.PENDING_VERIFICATION
    ) {
      return genericResponse;
    }

    /*
     * Generate replacement verification token.
     */
    const rawVerificationToken = randomBytes(32).toString('hex');

    const tokenHash = this.hashToken(rawVerificationToken);

    const now = new Date();

    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    /*
     * Invalidate old unused verification tokens
     * and create the new one atomically.
     */
    await this.prisma.$transaction([
      this.prisma.verificationToken.updateMany({
        where: {
          userId: user.id,

          type: VerificationTokenType.EMAIL_VERIFICATION,

          consumedAt: null,
        },

        data: {
          consumedAt: now,
        },
      }),

      this.prisma.verificationToken.create({
        data: {
          userId: user.id,

          type: VerificationTokenType.EMAIL_VERIFICATION,

          tokenHash,

          expiresAt,
        },
      }),
    ]);

    /*
     * Send replacement verification email.
     */
    try {
      await this.mailService.sendVerificationEmail({
        to: user.email,

        firstName: user.profile?.firstName ?? null,

        token: rawVerificationToken,
      });
    } catch (error) {
      this.logger.error(
        'Unable to resend verification email.',
        error instanceof Error ? error.stack : undefined,
      );
    }

    return genericResponse;
  }

  async login(
    dto: LoginDto,
    metadata?: {
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    const identifier = dto.identifier.trim().toLowerCase();

    /*
     * Authentication supports:
     *
     * email + password
     * OR
     * username + password
     */
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          {
            email: identifier,
          },
          {
            username: identifier,
          },
        ],
      },

      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        status: true,
        emailVerifiedAt: true,

        profile: {
          select: {
            firstName: true,
            lastName: true,
            preferredLanguage: true,
          },
        },
      },
    });

    /*
     * Do not reveal whether the account exists.
     */
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    /*
     * Account must first complete email verification.
     */
    if (
      !user.emailVerifiedAt ||
      user.status === UserStatus.PENDING_VERIFICATION
    ) {
      throw new ForbiddenException(
        'Please verify your email address before signing in.',
      );
    }

    /*
     * Suspended and disabled accounts cannot authenticate.
     */
    if (
      user.status === UserStatus.SUSPENDED ||
      user.status === UserStatus.DISABLED
    ) {
      throw new ForbiddenException(
        'This account is not currently allowed to sign in.',
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('This account is not currently active.');
    }

    const sessionId = randomUUID();

    /*
     * Refresh tokens are intentionally opaque.
     *
     * sessionId.secret
     *
     * This lets us efficiently locate the AuthSession
     * without storing the raw token.
     */
    const refreshSecret = randomBytes(48).toString('base64url');

    const rawRefreshToken = `${sessionId}.${refreshSecret}`;

    const refreshTokenHash = this.hashToken(rawRefreshToken);

    const now = new Date();

    const accessTtlSeconds = this.configService.getOrThrow<number>(
      'JWT_ACCESS_TTL_SECONDS',
    );

    const refreshTtlSeconds = this.configService.getOrThrow<number>(
      'JWT_REFRESH_TTL_SECONDS',
    );

    const accessTokenExpiresAt = new Date(
      now.getTime() + accessTtlSeconds * 1000,
    );

    const refreshTokenExpiresAt = new Date(
      now.getTime() + refreshTtlSeconds * 1000,
    );

    const payload: JwtPayload = {
      sub: user.id,
      sid: sessionId,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: accessTtlSeconds,
    });

    /*
     * Session creation and last-login update
     * are persisted atomically.
     */
    await this.prisma.$transaction([
      this.prisma.authSession.create({
        data: {
          id: sessionId,

          userId: user.id,

          refreshTokenHash,

          expiresAt: refreshTokenExpiresAt,

          ipAddress: metadata?.ipAddress ?? null,

          userAgent: metadata?.userAgent ?? null,
        },
      }),

      this.prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          lastLoginAt: now,
        },
      }),
    ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        status: user.status,
        profile: user.profile,
      },

      accessToken,
      accessTokenExpiresAt,

      /*
       * Controller will put this inside
       * an HttpOnly cookie.
       */
      refreshToken: rawRefreshToken,
      refreshTokenExpiresAt,
    };
  }

  async logout(rawRefreshToken?: string) {
    /*
     * Logout remains idempotent.
     *
     * Even if the cookie is already missing or invalid,
     * the API returns a successful logout response.
     */
    if (!rawRefreshToken) {
      return {
        loggedOut: true,
        message: 'Logged out successfully.',
      };
    }

    /*
     * Refresh token format:
     *
     * sessionId.secret
     */
    const separatorIndex = rawRefreshToken.indexOf('.');

    if (separatorIndex <= 0) {
      return {
        loggedOut: true,
        message: 'Logged out successfully.',
      };
    }

    const sessionId = rawRefreshToken.slice(0, separatorIndex);

    if (!sessionId) {
      return {
        loggedOut: true,
        message: 'Logged out successfully.',
      };
    }

    const session = await this.prisma.authSession.findUnique({
      where: {
        id: sessionId,
      },

      select: {
        id: true,
        refreshTokenHash: true,
        revokedAt: true,
      },
    });

    /*
     * Do not expose whether the session exists.
     */
    if (!session) {
      return {
        loggedOut: true,
        message: 'Logged out successfully.',
      };
    }

    /*
     * Verify that the supplied refresh token actually
     * belongs to the session before revoking it.
     */
    const suppliedTokenHash = this.hashToken(rawRefreshToken);

    if (suppliedTokenHash !== session.refreshTokenHash) {
      return {
        loggedOut: true,
        message: 'Logged out successfully.',
      };
    }

    /*
     * Revoke only if it hasn't already been revoked.
     */
    if (!session.revokedAt) {
      const now = new Date();

      await this.prisma.authSession.update({
        where: {
          id: session.id,
        },

        data: {
          revokedAt: now,
          lastUsedAt: now,
        },
      });
    }

    return {
      loggedOut: true,
      message: 'Logged out successfully.',
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,

        profile: {
          select: {
            firstName: true,
            lastName: true,
            preferredLanguage: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists.');
    }

    if (user.status !== UserStatus.ACTIVE || !user.emailVerifiedAt) {
      throw new UnauthorizedException('This account is not currently active.');
    }

    return {
      user,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | PRIVATE HELPERS
  |--------------------------------------------------------------------------
  */

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
