import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
  CensusService,
} from './census.service.js';

import {
  UpdateCensusRecordDto,
} from './dto/update-census-record.dto.js';

type AuthenticatedRequest =
  Request & {
    auth?: {
      userId?: string;
      sessionId?: string;
    };
  };

@ApiTags(
  'Census',
)
@ApiBearerAuth(
  'access-token',
)
@Controller(
  'census',
)
@UseGuards(
  AccessTokenGuard,
  PermissionsGuard,
)
export class CensusController {
  constructor(
    private readonly censusService:
      CensusService,
  ) {}

  @Post(
    'me',
  )
  @RequirePermissions(
    'census.records.create',
  )
  @ApiOperation({
    summary:
      'Create my census draft',
  })
  @ApiCreatedResponse()
  createMyDraft(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.censusService.createDraft(
      request.auth!.userId!,
    );
  }

  @Get(
    'me',
  )
  @RequirePermissions(
    'census.records.read.self',
  )
  @ApiOperation({
    summary:
      'Get my census record',
  })
  @ApiOkResponse()
  getMyCensus(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.censusService.getMyCensus(
      request.auth!.userId!,
    );
  }

  @Patch(
    'me/:recordId',
  )
  @RequirePermissions(
    'census.records.create',
  )
  @ApiOperation({
    summary:
      'Update my census draft',
  })
  @ApiOkResponse()
  updateMyCensus(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'recordId',
      ParseUUIDPipe,
    )
    recordId:
      string,

    @Body()
    dto:
      UpdateCensusRecordDto,
  ) {
    return this.censusService.updateMyCensus(
      request.auth!.userId!,
      recordId,
      dto,
    );
  }
}