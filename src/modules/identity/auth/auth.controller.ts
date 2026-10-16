import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiHeader,
} from '@nestjs/swagger';

import type {
  Request,
  Response,
} from 'express';

import {
  AuthorizationService,
} from '../authorization/authorization.service.js';

import {
  AuthService,
} from './auth.service.js';

import {
  LoginDto,
} from './dto/login.dto.js';

import {
  RegisterDto,
} from './dto/register.dto.js';

import {
  ResendVerificationDto,
} from './dto/resend-verification.dto.js';

import {
  VerifyEmailDto,
} from './dto/verify-email.dto.js';

import {
  AccessTokenGuard,
} from './guards/access-token.guard.js';

import type {
  AuthenticatedRequest,
} from './interfaces/authenticated-request.interface.js';

import {
  AuthRateLimitGuard,
} from './guards/auth-rate-limit.guard.js';

import {
  AuthCookieGuard,
} from './guards/auth-cookie.guard.js';

@ApiTags(
  'Authentication',
)
@Controller(
  'auth',
)
@UseGuards(
  AuthRateLimitGuard,
)
export class AuthController {
  constructor(
    private readonly authService:
      AuthService,

    private readonly authorizationService:
      AuthorizationService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | REGISTER
  |--------------------------------------------------------------------------
  */

  @Post(
    'register',
  )
  @ApiOperation({
    summary:
      'Register a new MINREX user account',
  })
  @ApiCreatedResponse({
    description:
      'Account created successfully. Email verification is required.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid registration data.',
  })
  @ApiConflictResponse({
    description:
      'An account already exists with the supplied email or username.',
  })
  register(
    @Body()
    dto:
      RegisterDto,
  ) {
    return this.authService.register(
      dto,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | VERIFY EMAIL
  |--------------------------------------------------------------------------
  */

  @Post(
    'verify-email',
  )
  @HttpCode(
    HttpStatus.OK,
  )
  @ApiOperation({
    summary:
      'Verify the email address of a MINREX account',
  })
  @ApiOkResponse({
    description:
      'Email address verified successfully.',
  })
  @ApiBadRequestResponse({
    description:
      'Verification token is invalid or expired.',
  })
  verifyEmail(
    @Body()
    dto:
      VerifyEmailDto,
  ) {
    return this.authService.verifyEmail(
      dto,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | RESEND VERIFICATION
  |--------------------------------------------------------------------------
  */

  @Post(
    'resend-verification',
  )
  @HttpCode(
    HttpStatus.OK,
  )
  @ApiOperation({
    summary:
      'Request a new email verification token',
  })
  @ApiOkResponse({
    description:
      'Verification request processed successfully.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid request data.',
  })
  resendVerification(
    @Body()
    dto:
      ResendVerificationDto,
  ) {
    return this.authService.resendVerification(
      dto,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | LOGIN
  |--------------------------------------------------------------------------
  */

  @Post(
    'login',
  )
  @HttpCode(
    HttpStatus.OK,
  )
  @ApiOperation({
    summary:
      'Sign in using an email address or username',
  })
  @ApiOkResponse({
    description:
      'Authentication successful.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid login request.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Invalid email, username or password.',
  })
  @ApiForbiddenResponse({
    description:
      'The account is not verified, suspended or disabled.',
  })
  async login(
    @Body()
    dto:
      LoginDto,

    @Req()
    request:
      Request,

    @Res({
      passthrough:
        true,
    })
    response:
      Response,
  ) {
    const result =
      await this.authService.login(
        dto,
        {
          ipAddress:
            request.ip ??
            null,

          userAgent:
            request.headers[
              'user-agent'
            ] ??
            null,
        },
      );

    const {
      refreshToken,
      refreshTokenExpiresAt,
      ...responseData
    } =
      result;

    /*
     * Refresh token remains inaccessible
     * from frontend JavaScript.
     */
    response.cookie(
      'minrex_refresh_token',
      refreshToken,
      {
        httpOnly:
          true,

        secure:
          process.env.NODE_ENV ===
          'production',

        sameSite:
          'lax',

        expires:
          refreshTokenExpiresAt,

        path:
          '/api/v1/auth',
      },
    );

    return responseData;
  }

  /*
  |--------------------------------------------------------------------------
  | REFRESH
  |--------------------------------------------------------------------------
  */

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthCookieGuard)
  @ApiOperation({
    summary: 'Refresh access token and rotate the refresh token',
  })
  @ApiHeader({
    name: 'x-minrex-client',
    required: true,
    description: 'Must contain the value "web".',
  })
  @ApiOkResponse({
    description: 'Access token renewed and refresh cookie rotated.',
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token is missing, invalid, expired or reused.',
  })
  @ApiForbiddenResponse({
    description: 'Request header is missing or origin is not allowed.',
  })
  async refresh(
    @Req()
    request: Request,
  
    @Res({ passthrough: true })
    response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
  
    const rawRefreshToken: unknown =
      request.cookies?.['minrex_refresh_token'];
  
    try {
      const result =
        await this.authService.refresh(rawRefreshToken);
  
      const {
        refreshToken,
        refreshTokenExpiresAt,
        ...responseData
      } = result;
  
      response.cookie(
        'minrex_refresh_token',
        refreshToken,
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          expires: refreshTokenExpiresAt,
          path: '/api/v1/auth',
        },
      );
  
      return responseData;
    } catch (error) {
      /*
       * Clear invalid authentication cookies.
       * Preserve the cookie on database or infrastructure errors.
       */
      if (error instanceof UnauthorizedException) {
        response.clearCookie(
          'minrex_refresh_token',
          {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/api/v1/auth',
          },
        );
      }
  
      throw error;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | LOGOUT
  |--------------------------------------------------------------------------
  */

  @Post(
    'logout',
  )
  @HttpCode(
    HttpStatus.OK,
  )
  @ApiOperation({
    summary:
      'Sign out from the current session',
  })
  @ApiOkResponse({
    description:
      'Current authentication session revoked successfully.',
  })
  async logout(
    @Req()
    request:
      Request,

    @Res({
      passthrough:
        true,
    })
    response:
      Response,
  ) {
    const refreshToken =
      request.cookies?.[
        'minrex_refresh_token'
      ] as
        | string
        | undefined;

    const result =
      await this.authService.logout(
        refreshToken,
      );

    response.clearCookie(
      'minrex_refresh_token',
      {
        httpOnly:
          true,

        secure:
          process.env.NODE_ENV ===
          'production',

        sameSite:
          'lax',

        path:
          '/api/v1/auth',
      },
    );

    return result;
  }

  /*
  |--------------------------------------------------------------------------
  | CURRENT AUTHENTICATED USER
  |--------------------------------------------------------------------------
  */

  @Get(
    'me',
  )
  @UseGuards(
    AccessTokenGuard,
  )
  @ApiBearerAuth(
    'access-token',
  )
  @ApiOperation({
    summary:
      'Get the current user and authorization context',
  })
  @ApiOkResponse({
    description:
      'Authenticated user and current authorization context returned successfully.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Access token is missing, invalid, expired or belongs to a revoked session.',
  })
  async me(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    /*
     * Authentication information and authorization
     * information are intentionally retrieved from
     * current database state.
     */
    const [
      currentUser,
      authorization,
    ] =
      await Promise.all([
        this.authService.getCurrentUser(
          request.auth.userId,
        ),

        this.authorizationService.getUserAuthorizationContext(
          request.auth.userId,
        ),
      ]);

    return {
      user:
        currentUser.user,

      authorization,
    };
  }
}