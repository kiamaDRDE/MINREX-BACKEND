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

import type {
  Request,
} from 'express';

import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  AccessTokenGuard,
} from '../identity/auth/guards/access-token.guard.js';

import {
  RequirePermissions,
} from '../identity/authorization/decorators/require-permissions.decorator.js';

import {
  PermissionsGuard,
} from '../identity/authorization/guards/permissions.guard.js';

import {
  AssistanceService,
} from './assistance.service.js';

import {
  CreateAssistanceCaseDto,
} from './dto/create-assistance-case.dto.js';

type AuthenticatedRequest =
  Request & {
    auth?: {
      userId?: string;
      sessionId?: string;
    };
  };

@ApiTags(
  'Assistance & Protection',
)
@ApiBearerAuth(
  'access-token',
)
@Controller(
  'assistance',
)
@UseGuards(
  AccessTokenGuard,
  PermissionsGuard,
)
export class AssistanceController {
  constructor(
    private readonly assistanceService:
      AssistanceService,
  ) {}

  @Post(
    'me/cases',
  )
  @RequirePermissions(
    'assistance.cases.create',
  )
  @ApiOperation({
    summary:
      'Create an assistance request',
  })
  @ApiCreatedResponse({
    description:
      'Assistance request created and routed successfully.',
  })
  createMyCase(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      CreateAssistanceCaseDto,
  ) {
    return this.assistanceService.createMyCase(
      request.auth!.userId!,
      dto,
    );
  }

  @Get(
    'me/cases',
  )
  @RequirePermissions(
    'assistance.cases.read.self',
  )
  @ApiOperation({
    summary:
      'List my assistance requests',
  })
  @ApiOkResponse()
  findMyCases(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.assistanceService.findMyCases(
      request.auth!.userId!,
    );
  }

  @Get(
    'me/cases/:caseId',
  )
  @RequirePermissions(
    'assistance.cases.read.self',
  )
  @ApiOperation({
    summary:
      'Get one of my assistance requests',
  })
  @ApiOkResponse()
  findMyCase(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'caseId',
      ParseUUIDPipe,
    )
    caseId:
      string,
  ) {
    return this.assistanceService.findMyCase(
      request.auth!.userId!,
      caseId,
    );
  }
}