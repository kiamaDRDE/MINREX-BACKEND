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

import type {
  Request,
} from 'express';

import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  AccessTokenGuard,
} from '../../identity/auth/guards/access-token.guard.js';

import {
  AuthorizationScope,
} from '../../identity/authorization/decorators/authorization-scope.decorator.js';

import {
  RequirePermissions,
} from '../../identity/authorization/decorators/require-permissions.decorator.js';

import {
  PermissionsGuard,
} from '../../identity/authorization/guards/permissions.guard.js';

import {
  CensusAgentService,
} from './census-agent.service.js';

import {
  ListCensusRecordsQueryDto,
} from './dto/list-census-records-query.dto.js';

import {
  RejectCensusDto,
} from './dto/reject-census.dto.js';

import {
  RequestCorrectionDto,
} from './dto/request-correction.dto.js';

import {
  VerifyCensusDto,
} from './dto/verify-census.dto.js';

type AuthenticatedRequest =
  Request & {
    auth?: {
      userId?: string;
      sessionId?: string;
    };
  };

@ApiTags(
  'Census - Agent Processing',
)
@ApiBearerAuth(
  'access-token',
)
@Controller(
  'census/posts/:postId/records',
)
@UseGuards(
  AccessTokenGuard,
  PermissionsGuard,
)
export class CensusAgentController {
  constructor(
    private readonly censusAgentService:
      CensusAgentService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | List
  |--------------------------------------------------------------------------
  */

  @Get()
  @RequirePermissions(
    'census.records.read',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  @ApiOperation({
    summary:
      'List census records assigned to a diplomatic post',
  })
  @ApiOkResponse()
  findRecords(
    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId: string,

    @Query()
    query:
      ListCensusRecordsQueryDto,
  ) {
    return this.censusAgentService.findRecords(
      postId,
      query,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Details
  |--------------------------------------------------------------------------
  */

  @Get(
    ':recordId',
  )
  @RequirePermissions(
    'census.records.read',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  @ApiOperation({
    summary:
      'Get a census record assigned to a diplomatic post',
  })
  findRecord(
    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId: string,

    @Param(
      'recordId',
      ParseUUIDPipe,
    )
    recordId: string,
  ) {
    return this.censusAgentService.findRecord(
      postId,
      recordId,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Start review
  |--------------------------------------------------------------------------
  */

  @Post(
    ':recordId/start-review',
  )
  @RequirePermissions(
    'census.records.review',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  @ApiOperation({
    summary:
      'Start reviewing a submitted census record',
  })
  startReview(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId: string,

    @Param(
      'recordId',
      ParseUUIDPipe,
    )
    recordId: string,
  ) {
    return this.censusAgentService.startReview(
      request.auth!.userId!,
      postId,
      recordId,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Correction
  |--------------------------------------------------------------------------
  */

  @Post(
    ':recordId/request-correction',
  )
  @RequirePermissions(
    'census.records.request_correction',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  @ApiOperation({
    summary:
      'Request corrections to a census record',
  })
  requestCorrection(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId: string,

    @Param(
      'recordId',
      ParseUUIDPipe,
    )
    recordId: string,

    @Body()
    dto:
      RequestCorrectionDto,
  ) {
    return this.censusAgentService.requestCorrection(
      request.auth!.userId!,
      postId,
      recordId,
      dto,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Verify
  |--------------------------------------------------------------------------
  */

  @Post(
    ':recordId/verify',
  )
  @RequirePermissions(
    'census.records.verify',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  @ApiOperation({
    summary:
      'Verify a census record',
  })
  verify(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId: string,

    @Param(
      'recordId',
      ParseUUIDPipe,
    )
    recordId: string,

    @Body()
    dto:
      VerifyCensusDto,
  ) {
    return this.censusAgentService.verify(
      request.auth!.userId!,
      postId,
      recordId,
      dto,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Reject
  |--------------------------------------------------------------------------
  */

  @Post(
    ':recordId/reject',
  )
  @RequirePermissions(
    'census.records.verify',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  @ApiOperation({
    summary:
      'Reject a census record',
  })
  reject(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId: string,

    @Param(
      'recordId',
      ParseUUIDPipe,
    )
    recordId: string,

    @Body()
    dto:
      RejectCensusDto,
  ) {
    return this.censusAgentService.reject(
      request.auth!.userId!,
      postId,
      recordId,
      dto,
    );
  }
}