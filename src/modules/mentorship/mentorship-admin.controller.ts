import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
  ListMentorshipRequestsQueryDto,
} from './dto/list-mentorship-requests-query.dto.js';

import {
  MatchMentorshipRequestDto,
} from './dto/match-mentorship-request.dto.js';

import {
  MentorshipService,
} from './mentorship.service.js';

import {
  RejectMentorshipRequestDto,
} from './dto/reject-mentorship-request.dto.js';

@ApiTags('Mentorship - Administration')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('mentorship/admin')
export class MentorshipAdminController {
  constructor(
    private readonly mentorshipService:
      MentorshipService,
  ) {}

  @Get('requests')
  @ApiOperation({
    summary:
      'List mentorship requests for administration',
  })
  findRequests(
    @Req()
    request: AuthenticatedRequest,

    @Query()
    query: ListMentorshipRequestsQueryDto,
  ) {
    return this.mentorshipService.findAdminRequests(
      request.auth.userId,
      query,
    );
  }

  @Post(
    'requests/:requestId/match',
  )
  @ApiOperation({
    summary:
      'Assign an eligible mentor to a mentorship request',
  })
  matchRequest(
    @Req()
    request: AuthenticatedRequest,

    @Param(
      'requestId',
      ParseUUIDPipe,
    )
    requestId: string,

    @Body()
    dto: MatchMentorshipRequestDto,
  ) {
    return this.mentorshipService.matchRequest(
      request.auth.userId,
      requestId,
      dto,
    );
  }

  @Post(
    'requests/:requestId/reject',
  )
  @ApiOperation({
    summary:
      'Reject a submitted mentorship request',
  })
  rejectRequest(
    @Req()
    request: AuthenticatedRequest,
  
    @Param(
      'requestId',
      ParseUUIDPipe,
    )
    requestId: string,
  
    @Body()
    dto: RejectMentorshipRequestDto,
  ) {
    return this.mentorshipService.rejectRequest(
      request.auth.userId,
      requestId,
      dto,
    );
  }
}