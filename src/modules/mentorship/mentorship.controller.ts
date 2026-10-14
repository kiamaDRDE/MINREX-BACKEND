import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  AccessTokenGuard,
} from '../identity/auth/guards/access-token.guard.js';

import type {
  AuthenticatedRequest,
} from '../identity/auth/interfaces/authenticated-request.interface.js';

import {
  CreateMentorshipRequestDto,
} from './dto/create-mentorship-request.dto.js';

import {
  MentorshipService,
} from './mentorship.service.js';

@ApiTags('Mentorship')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('mentorship')
export class MentorshipController {
  constructor(
    private readonly mentorshipService:
      MentorshipService,
  ) {}

  @Post('me/requests')
  @ApiOperation({
    summary:
      'Create a mentorship request for the authenticated user',
  })
  createMyRequest(
    @Req()
    request: AuthenticatedRequest,

    @Body()
    dto: CreateMentorshipRequestDto,
  ) {
    return this.mentorshipService.createMyRequest(
      request.auth.userId,
      dto,
    );
  }

  @Get('me/requests')
  @ApiOperation({
    summary:
      'List mentorship requests created by the authenticated user',
  })
  findMyRequests(
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.mentorshipService.findMyRequests(
      request.auth.userId,
    );
  }

  @Get('me/requests/:requestId')
  @ApiOperation({
    summary:
      'Get one mentorship request belonging to the authenticated user',
  })
  findMyRequest(
    @Req()
    request: AuthenticatedRequest,

    @Param(
      'requestId',
      ParseUUIDPipe,
    )
    requestId: string,
  ) {
    return this.mentorshipService.findMyRequest(
      request.auth.userId,
      requestId,
    );
  }
}