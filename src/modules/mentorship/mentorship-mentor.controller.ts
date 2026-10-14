import {
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
  MentorshipService,
} from './mentorship.service.js';

@ApiTags('Mentorship - Mentor')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('mentorship/mentor')
export class MentorshipMentorController {
  constructor(
    private readonly mentorshipService:
      MentorshipService,
  ) {}

  @Get('requests')
  @ApiOperation({
    summary:
      'List mentorship requests assigned to the authenticated mentor',
  })
  findMyAssignedRequests(
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.mentorshipService.findMentorRequests(
      request.auth.userId,
    );
  }

  @Get('requests/:requestId')
  @ApiOperation({
    summary:
      'Get one mentorship request assigned to the authenticated mentor',
  })
  findMyAssignedRequest(
    @Req()
    request: AuthenticatedRequest,

    @Param(
      'requestId',
      ParseUUIDPipe,
    )
    requestId: string,
  ) {
    return this.mentorshipService.findMentorRequest(
      request.auth.userId,
      requestId,
    );
  }

  @Post('requests/:requestId/start')
  @ApiOperation({
    summary:
      'Start an assigned mentorship request',
  })
  startRequest(
    @Req()
    request: AuthenticatedRequest,

    @Param(
      'requestId',
      ParseUUIDPipe,
    )
    requestId: string,
  ) {
    return this.mentorshipService.startMentorship(
      request.auth.userId,
      requestId,
    );
  }

  @Post('requests/:requestId/complete')
  @ApiOperation({
    summary:
      'Complete an active mentorship request',
  })
  completeRequest(
    @Req()
    request: AuthenticatedRequest,

    @Param(
      'requestId',
      ParseUUIDPipe,
    )
    requestId: string,
  ) {
    return this.mentorshipService.completeMentorship(
      request.auth.userId,
      requestId,
    );
  }
}