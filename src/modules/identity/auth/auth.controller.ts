import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { Request, Response } from 'express';

import { AuthService } from './auth.service.js';

import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /*
  |--------------------------------------------------------------------------
  | REGISTER
  |--------------------------------------------------------------------------
  */

  @Post('register')
  @ApiOperation({
    summary: 'Register a new MINREX user account',
  })
  @ApiCreatedResponse({
    description:
      'Account created successfully. Email verification is required.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid registration data.',
  })
  @ApiConflictResponse({
    description:
      'An account already exists with the supplied email or username.',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /*
  |--------------------------------------------------------------------------
  | VERIFY EMAIL
  |--------------------------------------------------------------------------
  */

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify the email address of a MINREX account',
  })
  @ApiOkResponse({
    description: 'Email address verified successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Verification token is invalid or expired.',
  })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  /*
  |--------------------------------------------------------------------------
  | RESEND VERIFICATION
  |--------------------------------------------------------------------------
  */

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a new email verification token',
  })
  @ApiOkResponse({
    description: 'Verification request processed successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data.',
  })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  /*
  |--------------------------------------------------------------------------
  | LOGIN
  |--------------------------------------------------------------------------
  */

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in using an email address or username',
  })
  @ApiOkResponse({
    description: 'Authentication successful.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid login request.',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid email, username or password.',
  })
  @ApiForbiddenResponse({
    description: 'The account is not verified, suspended or disabled.',
  })
  async login(
    @Body() dto: LoginDto,

    @Req()
    request: Request,

    @Res({
      passthrough: true,
    })
    response: Response,
  ) {
    const result = await this.authService.login(dto, {
      ipAddress: request.ip ?? null,

      userAgent: request.headers['user-agent'] ?? null,
    });

    const { refreshToken, refreshTokenExpiresAt, ...responseData } = result;

    /*
     * Refresh token is stored in an HttpOnly cookie.
     * It is therefore inaccessible from frontend JavaScript.
     */
    response.cookie('minrex_refresh_token', refreshToken, {
      httpOnly: true,

      secure: process.env.NODE_ENV === 'production',

      sameSite: 'lax',

      expires: refreshTokenExpiresAt,

      path: '/api/v1/auth',
    });

    return responseData;
  }
}
