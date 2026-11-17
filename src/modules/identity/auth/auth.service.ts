import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import * as argon2 from 'argon2';

import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import {
  UserStatus,
  VerificationTokenType,
} from '../../../generated/prisma/enums.js';
import { RedisService } from '../../../infrastructure/cache/redis.service.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { MailService } from '../../../infrastructure/mail/mail.service.js';
import { SmsService } from '../../../infrastructure/sms/sms.service.js';

import { ConsularIdentityService } from './consular-identity.service.js';
import { ConsularChallengeDto } from './dto/consular-challenge.dto.js';
import { ConsularVerifyDto } from './dto/consular-verify.dto.js';
import { DevActivateDto } from './dto/dev-activate.dto.js';
import { DevGrantAdminDto } from './dto/dev-grant-admin.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';

import { LoginDto } from './dto/login.dto.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';
import { SYSTEM_ROLE_CODES } from '../authorization/constants/system-roles.constants.js';
import { isEmail, isUUID } from 'class-validator';

import {
  parsePhoneNumberFromString,
} from 'libphonenumber-js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
    private readonly redisService: RedisService,
    private readonly consularIdentityService: ConsularIdentityService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | DEV ENDPOINT GUARD (STRICTLY BLOCKED IN PRODUCTION)
  |--------------------------------------------------------------------------
  */

  private assertDevEndpointsAllowed(
    endpointName: string,
  ): void {
    const nodeEnv = this.configService.get<string>(
      'NODE_ENV',
      'development',
    );
  
    const allowDevEndpoints =
      this.configService.get<string>(
        'ALLOW_DEV_ENDPOINTS',
      ) === 'true';
  
    if (
      nodeEnv !== 'development' ||
      !allowDevEndpoints
    ) {
      this.logger.warn(
        `Blocked attempt to invoke ${endpointName}.`,
      );
  
      throw new NotFoundException(
        `Cannot POST /api/v1/auth/${endpointName}`,
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | DEV ACTIVATE (TEMPORARY TESTING API)
  |--------------------------------------------------------------------------
  */

  async devActivate(dto: DevActivateDto) {
    this.assertDevEndpointsAllowed('dev-activate');

    const identifier = dto.identifier.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
    });

    if (!user) {
      throw new NotFoundException(
        `User with email or username '${dto.identifier}' not found.`,
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    this.logger.log(
      `User ${updatedUser.email} (${updatedUser.id}) status set to ACTIVE via dev-activate.`,
    );

    return {
      success: true,
      message: `User ${updatedUser.email} status set to ACTIVE.`,
      user: updatedUser,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | DEV GRANT PLATFORM ADMIN (TEMPORARY TESTING API)
  |--------------------------------------------------------------------------
  */

  async devGrantAdmin(dto: DevGrantAdminDto) {
    this.assertDevEndpointsAllowed('dev-grant-admin');

    const identifier = dto.identifier.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        `User with email or username '${dto.identifier}' not found.`,
      );
    }

    const adminRole = await this.prisma.role.findUnique({
      where: { code: SYSTEM_ROLE_CODES.PLATFORM_ADMIN },
    });

    if (!adminRole) {
      throw new NotFoundException(
        `System role ${SYSTEM_ROLE_CODES.PLATFORM_ADMIN} not found in database. Please run prisma db seed.`,
      );
    }

    const existingAssignment =
      await this.prisma.userRoleAssignment.findFirst({
        where: {
          userId: user.id,
          roleId: adminRole.id,
        },
      });

    if (!existingAssignment) {
      await this.prisma.userRoleAssignment.create({
        data: {
          userId: user.id,
          roleId: adminRole.id,
          isActive: true,
        },
      });
    }

    this.logger.log(
      `User ${user.email} (${user.id}) was granted PLATFORM_ADMIN role via dev-grant-admin.`,
    );

    return {
      success: true,
      message: `User ${user.email} was successfully granted PLATFORM_ADMIN role.`,
      userId: user.id,
      email: user.email,
      role: SYSTEM_ROLE_CODES.PLATFORM_ADMIN,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | REGISTER
  |--------------------------------------------------------------------------
  */

  async register(dto: RegisterDto) {
    const email =
      dto.email
        .trim()
        .toLowerCase();
  
    const username =
      dto.username
        .trim()
        .toLowerCase();
  
    /*
     * Parse and normalize phone number
     * to international E.164 format.
     */
    const parsedPhone =
      parsePhoneNumberFromString(
        dto.phone.trim(),
      );
  
    if (
      !parsedPhone ||
      !parsedPhone.isValid()
    ) {
      throw new BadRequestException(
        'The supplied phone number is invalid.',
      );
    }
  
    const phone =
      parsedPhone.number.toString();
  
    /*
     * Check authentication identifiers.
     */
    const existingUser =
      await this.prisma.user.findFirst({
        where: {
          OR: [
            {
              email,
            },

            {
              username,
            },

            {
              phone,
            },
          ],
        },

        select: {
          email:
            true,

          username:
            true,

          phone:
            true,
        },
      });
  
    if (
      existingUser?.email ===
      email
    ) {
      throw new ConflictException(
        'An account already exists with this email address.',
      );
    }
  
    if (
      existingUser?.username ===
      username
    ) {
      throw new ConflictException(
        'This username is already taken.',
      );
    }
  
    if (
      existingUser?.phone ===
      phone
    ) {
      throw new ConflictException(
        'An account already exists with this phone number.',
      );
    }
  
    /*
     * Hash password using Argon2id.
     */
    const passwordHash =
      await argon2.hash(
        dto.password,
        {
          type:
            argon2.argon2id,
        },
      );
  
    /*
     * Generate email verification token.
     */
    const rawVerificationToken =
      randomBytes(
        32,
      ).toString(
        'hex',
      );
  
    const tokenHash =
      this.hashToken(
        rawVerificationToken,
      );
  
    const verificationExpiresAt =
      new Date(
        Date.now() +
          30 *
            60 *
            1000,
      );

    const diasporaRole =
      await this.prisma.role.findUnique({
        where: {
          code: SYSTEM_ROLE_CODES.DIASPORA_MEMBER,
        },
    
        select: {
          id: true,
          isActive: true,
        },
      });
    
    if (!diasporaRole || !diasporaRole.isActive) {
      throw new InternalServerErrorException(
        'The DIASPORA_MEMBER system role is missing or inactive. Run the database seed.',
      );
    }
  
    /*
     * Create user, profile and verification token.
     */
    const user =
      await this.prisma.user.create({
        data: {
          email,
          username,
          phone,
          passwordHash,
          status: UserStatus.PENDING_VERIFICATION,
          emailVerifiedAt: null,
  
          profile: {
            create: {
              firstName:
                dto.firstName.trim(),
  
              lastName:
                dto.lastName.trim(),

              residenceCountry:
                dto.residenceCountry.trim(),
            },
          },

          roleAssignments: {
            create: {
              roleId: diasporaRole.id,
              isActive: true,
            },
          },
  
          verificationTokens: {
            create: {
              type:
                VerificationTokenType.EMAIL_VERIFICATION,
  
              tokenHash,
  
              expiresAt:
                verificationExpiresAt,
            },
          },
        },
  
        select: {
          id:
            true,
  
          email:
            true,
  
          username:
            true,
  
          phone:
            true,
  
          status:
            true,
  
          createdAt:
            true,
  
          profile: {
            select: {
              firstName:
                true,
  
              lastName:
                true,
  
              preferredLanguage:
                true,

              residenceCountry:
                true,
            },
          },
        },
      });
  
    /*
     * Send email verification.
     *
     * Failure to send the email must not cancel
     * the database registration.
     */
    try {
      await this.mailService.sendVerificationEmail({
        to:
          email,
  
        firstName:
          user.profile
            ?.firstName ??
          null,
  
        token:
          rawVerificationToken,
      });
    } catch (error) {
      this.logger.error(
        'Unable to send registration verification email.',
        error instanceof Error
          ? error.stack
          : undefined,
      );
    }
  
    return {
      user,
  
      verification: {
        required:
          true,
  
        channel:
          'EMAIL',
  
        expiresAt:
          verificationExpiresAt,
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
  
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
  
      const verificationToken = await tx.verificationToken.findFirst({
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
        },
      });
  
      if (!verificationToken) {
        throw new BadRequestException(
          'Verification token is invalid or has expired.',
        );
      }
  
      // Only one concurrent request can consume this token.
      const consumed = await tx.verificationToken.updateMany({
        where: {
          id: verificationToken.id,
          consumedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          consumedAt: now,
        },
      });
  
      if (consumed.count !== 1) {
        throw new BadRequestException(
          'Verification token is invalid or has expired.',
        );
      }
  
      // Never reactivate a suspended or disabled account.
      const activated = await tx.user.updateMany({
        where: {
          id: verificationToken.userId,
          status: UserStatus.PENDING_VERIFICATION,
          emailVerifiedAt: null,
        },
        data: {
          emailVerifiedAt: now,
          status: UserStatus.ACTIVE,
        },
      });
  
      if (activated.count !== 1) {
        // Throwing also rolls back token consumption.
        throw new BadRequestException(
          'Email verification cannot be completed for this account.',
        );
      }
  
      await tx.verificationToken.updateMany({
        where: {
          userId: verificationToken.userId,
          type: VerificationTokenType.EMAIL_VERIFICATION,
          consumedAt: null,
        },
        data: {
          consumedAt: now,
        },
      });
    });
  
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
        phone: true,
        passwordHash: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        consularIdentifier: true,
        consularVerifiedAt: true,

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

    return this.issueAuthSession(user, metadata);
  }

  /*
  |--------------------------------------------------------------------------
  | AUTH CAPABILITIES (DISCOVERY FOR FRONTEND LOGIN OPTIONS)
  |--------------------------------------------------------------------------
  */

  getAuthMethods() {
    const sms = this.smsService.getCapabilities();
    return {
      otp: {
        smsEnabled: sms.smsEnabled,
        smsProvider: sms.provider,
        smsProductionReady: sms.productionReady,
        emailFallbackEnabled: true,
      },
      consular: {
        enabled: true,
        supportsConsularNumber: true,
        supportsVerifiedCensusReference: true,
        supportsVerifiedDocumentNumber: true,
      },
    };
  }

  /*
  |--------------------------------------------------------------------------
  | OTP AUTHENTICATION (SMS / EMAIL)
  |--------------------------------------------------------------------------
  */

  async requestOtp(dto: RequestOtpDto) {
    const normalizedIdentifier = this.normalizeOtpIdentifier(
      dto.channel,
      dto.identifier,
    );

    if (dto.channel === 'SMS') {
      const capabilities = this.smsService.getCapabilities();
      if (!capabilities.smsEnabled) {
        throw new ServiceUnavailableException(
          'La passerelle SMS de production n’est pas active. Veuillez choisir l’envoi du code OTP par e-mail.',
        );
      }
    }

    const cooldownKey = `otp:${dto.channel}:${normalizedIdentifier}`;
    await this.assertOtpCooldown(cooldownKey);

    const user = await this.prisma.user.findFirst({
      where:
        dto.channel === 'SMS'
          ? { phone: normalizedIdentifier }
          : { email: normalizedIdentifier },
      select: {
        id: true,
        email: true,
        phone: true,
        status: true,
        emailVerifiedAt: true,
        profile: {
          select: {
            firstName: true,
          },
        },
      },
    });

    const genericResponse: {
      sent: boolean;
      channel: 'SMS' | 'EMAIL';
      expiresInSeconds: number;
      message: string;
      devOtpPreview?: string;
    } = {
      sent: true,
      channel: dto.channel,
      expiresInSeconds: 300,
      message:
        dto.channel === 'SMS'
          ? 'Si un compte actif correspond à ce numéro, un code de sécurité à 6 chiffres vient d’être envoyé par SMS.'
          : 'Si un compte actif correspond à cette adresse, un code de sécurité à 6 chiffres vient d’être envoyé par e-mail.',
    };

    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !user.emailVerifiedAt
    ) {
      return genericResponse;
    }

    const { code } = await this.generateAndStoreOtpToken(user.id, dto.channel);

    try {
      const dispatchRes = await this.dispatchOtpToChannel({
        channel: dto.channel,
        email: user.email,
        phone: user.phone,
        firstName: user.profile?.firstName ?? null,
        code,
        smsPurposeLabel: 'Connexion MINREX',
        emailPurposeLabel: 'Connexion à votre espace MINREX Diaspora',
      });

      if (dispatchRes.devOtpPreview) {
        genericResponse.devOtpPreview = dispatchRes.devOtpPreview;
      }
    } catch (error) {
      await this.clearOtpCooldown(cooldownKey);
      throw error;
    }

    return genericResponse;
  }

  async verifyOtp(
    dto: VerifyOtpDto,
    metadata?: {
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    const normalizedIdentifier = this.normalizeOtpIdentifier(
      dto.channel,
      dto.identifier,
    );

    const user = await this.prisma.user.findFirst({
      where:
        dto.channel === 'SMS'
          ? { phone: normalizedIdentifier }
          : { email: normalizedIdentifier },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        consularIdentifier: true,
        consularVerifiedAt: true,
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
      throw new UnauthorizedException('Code OTP invalide ou expiré.');
    }

    this.assertAccountAllowedToAuthenticate(user);

    await this.verifyAndConsumeOtp(user.id, dto.channel, dto.code);

    let updatedPhoneVerifiedAt = user.phoneVerifiedAt;
    if (dto.channel === 'SMS' && !updatedPhoneVerifiedAt) {
      updatedPhoneVerifiedAt = new Date();
      await this.prisma.user.update({
        where: { id: user.id },
        data: { phoneVerifiedAt: updatedPhoneVerifiedAt },
      });
    }

    return this.issueAuthSession(
      { ...user, phoneVerifiedAt: updatedPhoneVerifiedAt },
      metadata,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | CONSULAR IDENTITY AUTHENTICATION (2-FACTOR KYC + OTP)
  |--------------------------------------------------------------------------
  */

  async requestConsularChallenge(dto: ConsularChallengeDto) {
    const match = await this.consularIdentityService.verifyConsularCredentials(
      dto.consularId,
      dto.birthDate,
    );

    if (!match) {
      throw new UnauthorizedException(
        'Identité consulaire introuvable, dossier non encore validé ou date de naissance incorrecte.',
      );
    }

    const channel: 'EMAIL' | 'SMS' = dto.deliveryChannel ?? 'EMAIL';

    if (channel === 'SMS') {
      if (!match.user.phone) {
        throw new BadRequestException(
          'Aucun numéro de téléphone n’est rattaché à votre identité consulaire. Choisissez la vérification par e-mail.',
        );
      }
      if (!this.smsService.getCapabilities().smsEnabled) {
        throw new ServiceUnavailableException(
          'La passerelle SMS n’est pas active. Choisissez la réception du code par e-mail.',
        );
      }
    }

    const cooldownKey = `consular:${match.user.id}:${channel}`;
    await this.assertOtpCooldown(cooldownKey);

    const context = `CONSULAR:${channel}`;
    const { code } = await this.generateAndStoreOtpToken(match.user.id, context);

    const challengeId = randomUUID();
    const challengeKey = `minrex:auth:consular-challenge:${challengeId}`;
    const redisClient = this.redisService.getClient();

    if (redisClient.status !== 'ready') {
      await this.clearOtpCooldown(cooldownKey);
      throw new ServiceUnavailableException(
        'Service de validation temporairement indisponible.',
      );
    }

    let devOtpPreview: string | undefined;

    try {
      const dispatchRes = await this.dispatchOtpToChannel({
        channel,
        email: match.user.email,
        phone: match.user.phone,
        firstName: match.user.profile?.firstName ?? null,
        code,
        smsPurposeLabel: 'Connexion Identité Consulaire',
        emailPurposeLabel: `Connexion par Identité Consulaire (${match.consularIdentifier})`,
      });
      devOtpPreview = dispatchRes.devOtpPreview;

      await redisClient.set(
        challengeKey,
        JSON.stringify({
          userId: match.user.id,
          channel,
          consularIdentifier: match.consularIdentifier,
        }),
        'EX',
        300,
      );
    } catch (error) {
      await this.clearOtpCooldown(cooldownKey);
      await redisClient.del(challengeKey).catch(() => undefined);
      throw error;
    }

    const maskedDestination =
      channel === 'SMS' && match.user.phone
        ? this.maskPhone(match.user.phone)
        : this.maskEmail(match.user.email);

    return {
      challengeRequired: true,
      challengeId,
      channel,
      maskedDestination,
      consularIdentifier: match.consularIdentifier,
      postName: match.postName,
      expiresInSeconds: 300,
      ...(devOtpPreview ? { devOtpPreview } : {}),
    };
  }

  async verifyConsularChallenge(
    dto: ConsularVerifyDto,
    metadata?: {
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    const challengeKey = `minrex:auth:consular-challenge:${dto.challengeId}`;
    const redisClient = this.redisService.getClient();

    if (redisClient.status !== 'ready') {
      throw new ServiceUnavailableException(
        'Service de validation temporairement indisponible.',
      );
    }

    const rawChallenge = await redisClient.get(challengeKey);
    if (!rawChallenge) {
      throw new UnauthorizedException(
        'Défi d’identité consulaire invalide ou expiré. Veuillez recommencer.',
      );
    }

    let parsed: {
      userId: string;
      channel: 'EMAIL' | 'SMS';
      consularIdentifier: string;
    };
    try {
      parsed = JSON.parse(rawChallenge) as {
        userId: string;
        channel: 'EMAIL' | 'SMS';
        consularIdentifier: string;
      };
    } catch {
      throw new UnauthorizedException('Défi d’identité consulaire invalide.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: parsed.userId },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        consularIdentifier: true,
        consularVerifiedAt: true,
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
      throw new UnauthorizedException('Compte introuvable ou désactivé.');
    }

    this.assertAccountAllowedToAuthenticate(user);

    await this.verifyAndConsumeOtp(
      user.id,
      `CONSULAR:${parsed.channel}`,
      dto.code,
    );

    await redisClient.del(challengeKey).catch(() => undefined);

    this.logger.log(
      `Consular identity sign-in verified for user ${user.id} (${parsed.consularIdentifier}) via ${parsed.channel}.`,
    );

    return this.issueAuthSession(user, metadata);
  }

  private assertAccountAllowedToAuthenticate(user: {
    status: UserStatus;
    emailVerifiedAt: Date | null;
  }): void {
    if (!user.emailVerifiedAt || user.status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException(
        'Veuillez d’abord confirmer votre adresse e-mail avant de vous connecter.',
      );
    }

    if (
      user.status === UserStatus.SUSPENDED ||
      user.status === UserStatus.DISABLED ||
      user.status !== UserStatus.ACTIVE
    ) {
      throw new ForbiddenException(
        'Ce compte n’est actuellement pas autorisé à se connecter.',
      );
    }
  }

  private async issueAuthSession(
    user: {
      id: string;
      email: string;
      username: string;
      phone?: string | null;
      status: UserStatus;
      phoneVerifiedAt?: Date | null;
      consularIdentifier?: string | null;
      consularVerifiedAt?: Date | null;
      profile: {
        firstName: string;
        lastName: string;
        preferredLanguage: string;
      } | null;
    },
    metadata?: {
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {

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
        phone: user.phone ?? null,
        phoneVerifiedAt: user.phoneVerifiedAt ?? null,
        status: user.status,
        consularIdentifier: user.consularIdentifier ?? null,
        consularVerifiedAt: user.consularVerifiedAt ?? null,
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

  async refresh(rawRefreshToken: unknown) {
    const invalidToken = () =>
      new UnauthorizedException(
        'Authentication session is invalid or expired.',
      );
  
    /*
     * Expected format:
     * UUID.base64url-secret
     *
     * randomBytes(48).toString('base64url') produces
     * a secret containing 64 characters.
     */
    if (typeof rawRefreshToken !== 'string') {
      throw invalidToken();
    }
  
    const parts = rawRefreshToken.split('.');
  
    if (parts.length !== 2) {
      throw invalidToken();
    }
  
    const [sessionId, secret] = parts;
  
    if (
      !sessionId ||
      !isUUID(sessionId) ||
      !secret ||
      !/^[A-Za-z0-9_-]{64}$/.test(secret)
    ) {
      throw invalidToken();
    }
  
    const suppliedTokenHash = this.hashToken(rawRefreshToken);
  
    const result = await this.prisma.$transaction(async (tx) => {
      /*
       * Serialize refresh requests for this session.
       *
       * Tagged-template parameters are bound by Prisma;
       * do not replace this with string concatenation.
       */
      await tx.$queryRaw`
        SELECT id
        FROM auth_sessions
        WHERE id = ${sessionId}::uuid
        FOR UPDATE
      `;
  
      const session = await tx.authSession.findUnique({
        where: {
          id: sessionId,
        },
        select: {
          id: true,
          userId: true,
          refreshTokenHash: true,
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
  
      const now = new Date();
  
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= now
      ) {
        return null;
      }
  
      if (
        session.user.status !== UserStatus.ACTIVE ||
        !session.user.emailVerifiedAt
      ) {
        await tx.authSession.update({
          where: {
            id: session.id,
          },
          data: {
            revokedAt: now,
          },
        });
  
        return null;
      }
  
      if (session.refreshTokenHash !== suppliedTokenHash) {
        const consumedToken =
          await tx.consumedRefreshToken.findUnique({
            where: {
              tokenHash: suppliedTokenHash,
            },
            select: {
              sessionId: true,
            },
          });
  
        /*
         * Revoke only when this is a known previously
         * consumed token belonging to this session.
         *
         * A fabricated token must not let someone revoke
         * a session just by knowing its UUID.
         */
        if (consumedToken?.sessionId === session.id) {
          await tx.authSession.update({
            where: {
              id: session.id,
            },
            data: {
              revokedAt: now,
            },
          });
        }
  
        /*
         * Return instead of throwing here:
         * throwing would roll back the revocation.
         */
        return null;
      }
  
      const configuredAccessTtl =
        this.configService.getOrThrow<number>(
          'JWT_ACCESS_TTL_SECONDS',
        );
  
      if (
        !Number.isInteger(configuredAccessTtl) ||
        configuredAccessTtl <= 0
      ) {
        throw new Error(
          'JWT_ACCESS_TTL_SECONDS must be a positive integer.',
        );
      }
  
      const remainingSessionSeconds = Math.floor(
        (session.expiresAt.getTime() - now.getTime()) / 1000,
      );
  
      const accessTtlSeconds = Math.min(
        configuredAccessTtl,
        remainingSessionSeconds,
      );
  
      if (accessTtlSeconds <= 0) {
        return null;
      }
  
      const refreshSecret =
        randomBytes(48).toString('base64url');
  
      const nextRefreshToken =
        `${session.id}.${refreshSecret}`;
  
      const nextRefreshTokenHash =
        this.hashToken(nextRefreshToken);
  
      const payload: JwtPayload = {
        sub: session.userId,
        sid: session.id,
      };
  
      const accessToken = await this.jwtService.signAsync(
        payload,
        {
          expiresIn: accessTtlSeconds,
  
          // Distinguish tokens issued within the same second.
          jwtid: randomUUID(),
        },
      );
  
      /*
       * Archive the consumed token and replace the current
       * hash in the same transaction.
       */
      await tx.consumedRefreshToken.create({
        data: {
          sessionId: session.id,
          tokenHash: suppliedTokenHash,
          consumedAt: now,
        },
      });
  
      await tx.authSession.update({
        where: {
          id: session.id,
        },
        data: {
          refreshTokenHash: nextRefreshTokenHash,
          lastUsedAt: now,
        },
      });
  
      return {
        accessToken,
  
        accessTokenExpiresAt: new Date(
          now.getTime() + accessTtlSeconds * 1000,
        ),
  
        refreshToken: nextRefreshToken,
  
        // Keep the original absolute session expiration.
        refreshTokenExpiresAt: session.expiresAt,
      };
    });
  
    if (!result) {
      throw invalidToken();
    }
  
    return result;
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
        phoneVerifiedAt: true,
        consularIdentifier: true,
        consularVerifiedAt: true,
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

  private buildOtpTokenHash(
    userId: string,
    context: string,
    code: string,
  ): string {
    return this.hashToken(`otp:${userId}:${context}:${code}`);
  }

  private normalizeOtpIdentifier(
    channel: 'SMS' | 'EMAIL',
    rawIdentifier: string,
  ): string {
    const trimmed = rawIdentifier.trim();
    if (channel === 'EMAIL') {
      const normalized = trimmed.toLowerCase();
      if (!isEmail(normalized) || normalized.length > 255) {
        throw new BadRequestException('Adresse e-mail invalide.');
      }
      return normalized;
    }

    const parsedPhone = parsePhoneNumberFromString(trimmed);
    if (!parsedPhone || !parsedPhone.isValid()) {
      throw new BadRequestException(
        'Numéro de téléphone international invalide (format +indicatif requis).',
      );
    }
    return parsedPhone.number.toString();
  }

  private async dispatchOtpToChannel(params: {
    channel: 'SMS' | 'EMAIL';
    email: string;
    phone: string | null;
    firstName: string | null;
    code: string;
    smsPurposeLabel: string;
    emailPurposeLabel: string;
  }): Promise<{ devOtpPreview?: string }> {
    if (params.channel === 'SMS') {
      if (!params.phone) {
        throw new BadRequestException(
          'Aucun numéro de téléphone vérifiable associé à ce compte.',
        );
      }

      const smsRes = await this.smsService.sendOtpSms({
        to: params.phone,
        code: params.code,
        purposeLabel: params.smsPurposeLabel,
        expiresMinutes: 5,
      });

      const exposeDevOtp =
        this.configService.get<string>('NODE_ENV', 'development') ===
          'development' &&
        this.configService.get<boolean>('EXPOSE_DEV_OTP_IN_RESPONSE') === true &&
        smsRes.simulated;

      return exposeDevOtp ? { devOtpPreview: params.code } : {};
    }

    await this.mailService.sendOtpEmail({
      to: params.email,
      firstName: params.firstName,
      code: params.code,
      purposeLabel: params.emailPurposeLabel,
      expiresMinutes: 5,
    });

    return {};
  }

  private async clearOtpCooldown(scopeKey: string): Promise<void> {
    const client = this.redisService.getClient();
    if (client.status !== 'ready') {
      return;
    }
    const digest = this.hashToken(scopeKey);
    await client.del(`minrex:auth:otp-cooldown:${digest}`).catch(() => undefined);
  }

  private async assertOtpCooldown(scopeKey: string): Promise<void> {
    const client = this.redisService.getClient();
    if (client.status !== 'ready') {
      return;
    }

    const digest = this.hashToken(scopeKey);
    const redisKey = `minrex:auth:otp-cooldown:${digest}`;
    const created = await client.set(redisKey, '1', 'EX', 60, 'NX');
    if (created !== 'OK') {
      const ttl = await client.ttl(redisKey);
      const waitSeconds = ttl > 0 ? ttl : 60;
      throw new HttpException(
        `Veuillez patienter ${waitSeconds} secondes avant de demander un nouveau code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async generateAndStoreOtpToken(
    userId: string,
    context: string,
  ): Promise<{ tokenId: string; code: string; expiresAt: Date }> {
    const code = randomInt(100000, 1000000).toString();
    const tokenHash = this.buildOtpTokenHash(userId, context, code);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.verificationToken.updateMany({
        where: {
          userId,
          type: VerificationTokenType.MFA_OTP,
          consumedAt: null,
        },
        data: { consumedAt: now },
      });

      return tx.verificationToken.create({
        data: {
          userId,
          type: VerificationTokenType.MFA_OTP,
          tokenHash,
          expiresAt,
        },
        select: { id: true },
      });
    });

    return { tokenId: created.id, code, expiresAt };
  }

  private async verifyAndConsumeOtp(
    userId: string,
    context: string,
    rawCode: string,
  ): Promise<void> {
    const now = new Date();
    const token = await this.prisma.verificationToken.findFirst({
      where: {
        userId,
        type: VerificationTokenType.MFA_OTP,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tokenHash: true,
      },
    });

    if (!token) {
      throw new UnauthorizedException('Code OTP invalide ou expiré.');
    }

    const failKey = `minrex:auth:otp-fail:${token.id}`;
    const redisClient = this.redisService.getClient();

    if (redisClient.status === 'ready') {
      const fails = Number((await redisClient.get(failKey)) ?? '0');
      if (fails >= 5) {
        await this.prisma.verificationToken.updateMany({
          where: { id: token.id, consumedAt: null },
          data: { consumedAt: now },
        });
        throw new UnauthorizedException(
          'Trop de tentatives erronées. Veuillez demander un nouveau code.',
        );
      }
    }

    const expectedHash = this.buildOtpTokenHash(
      userId,
      context,
      rawCode.trim(),
    );
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    const actualBuf = Buffer.from(token.tokenHash, 'hex');
    const matches =
      expectedBuf.length === actualBuf.length &&
      timingSafeEqual(expectedBuf, actualBuf);

    if (!matches) {
      if (redisClient.status === 'ready') {
        const nextFails = await redisClient.incr(failKey);
        if (nextFails === 1) {
          await redisClient.expire(failKey, 300);
        }
        if (nextFails >= 5) {
          await this.prisma.verificationToken.updateMany({
            where: { id: token.id, consumedAt: null },
            data: { consumedAt: now },
          });
        }
      }
      throw new UnauthorizedException('Code OTP invalide ou expiré.');
    }

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.verificationToken.updateMany({
        where: {
          id: token.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException('Code OTP invalide ou expiré.');
      }
    });

    if (redisClient.status === 'ready') {
      await redisClient.del(failKey).catch(() => undefined);
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    const prefix = local.slice(0, Math.min(2, local.length));
    return `${prefix}***@${domain}`;
  }

  private maskPhone(phone: string): string {
    if (phone.length <= 6) return '***';
    return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
  }
}
