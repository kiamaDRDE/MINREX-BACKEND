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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type {
  Request,
} from 'express';

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
  AssistanceAgentService,
} from './assistance-agent.service.js';

import {
  AssignAssistanceCaseDto,
} from './dto/assign-assistance-case.dto.js';

import {
  CaseCommentDto,
} from './dto/case-comment.dto.js';

import {
  ListAssistanceCasesQueryDto,
} from './dto/list-assistance-cases-query.dto.js';

import {
  QualifyAssistanceCaseDto,
} from './dto/qualify-assistance-case.dto.js';

import {
  RejectAssistanceCaseDto,
} from './dto/reject-assistance-case.dto.js';

import {
  ResolveAssistanceCaseDto,
} from './dto/resolve-assistance-case.dto.js';

type AuthenticatedRequest =
  Request & {
    auth?: {
      userId?: string;
      sessionId?: string;
    };
  };

@ApiTags(
  'Assistance & Protection - Agent',
)
@ApiBearerAuth(
  'access-token',
)
@Controller(
  'assistance/posts/:postId/cases',
)
@UseGuards(
  AccessTokenGuard,
  PermissionsGuard,
)
export class AssistanceAgentController {
  constructor(
    private readonly assistanceAgentService:
      AssistanceAgentService,
  ) {}

  @Get()
  @RequirePermissions(
    'assistance.cases.read',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  @ApiOperation({
    summary:
      'List assistance cases for a diplomatic post',
  })
  @ApiOkResponse()
  findCases(
    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId:
      string,

    @Query()
    query:
      ListAssistanceCasesQueryDto,
  ) {
    return this.assistanceAgentService.findCases(
      postId,
      query,
    );
  }

  @Get(
    ':caseId',
  )
  @RequirePermissions(
    'assistance.cases.read',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  findCase(
    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId:
      string,

    @Param(
      'caseId',
      ParseUUIDPipe,
    )
    caseId:
      string,
  ) {
    return this.assistanceAgentService.findCase(
      postId,
      caseId,
    );
  }

  @Post(
    ':caseId/qualify',
  )
  @RequirePermissions(
    'assistance.cases.update',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  qualify(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId:
      string,

    @Param(
      'caseId',
      ParseUUIDPipe,
    )
    caseId:
      string,

    @Body()
    dto:
      QualifyAssistanceCaseDto,
  ) {
    return this.assistanceAgentService.qualify(
      request.auth!.userId!,
      postId,
      caseId,
      dto,
    );
  }

  @Post(
    ':caseId/assign',
  )
  @RequirePermissions(
    'assistance.cases.assign',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  assign(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId:
      string,

    @Param(
      'caseId',
      ParseUUIDPipe,
    )
    caseId:
      string,

    @Body()
    dto:
      AssignAssistanceCaseDto,
  ) {
    return this.assistanceAgentService.assign(
      request.auth!.userId!,
      postId,
      caseId,
      dto,
    );
  }

  @Post(
    ':caseId/start',
  )
  @RequirePermissions(
    'assistance.cases.update',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  startProgress(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId:
      string,

    @Param(
      'caseId',
      ParseUUIDPipe,
    )
    caseId:
      string,

    @Body()
    dto:
      CaseCommentDto,
  ) {
    return this.assistanceAgentService.startProgress(
      request.auth!.userId!,
      postId,
      caseId,
      dto,
    );
  }

  @Post(
    ':caseId/resolve',
  )
  @RequirePermissions(
    'assistance.cases.update',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  resolve(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId:
      string,

    @Param(
      'caseId',
      ParseUUIDPipe,
    )
    caseId:
      string,

    @Body()
    dto:
      ResolveAssistanceCaseDto,
  ) {
    return this.assistanceAgentService.resolve(
      request.auth!.userId!,
      postId,
      caseId,
      dto,
    );
  }

  @Post(
    ':caseId/close',
  )
  @RequirePermissions(
    'assistance.cases.close',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  close(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId:
      string,

    @Param(
      'caseId',
      ParseUUIDPipe,
    )
    caseId:
      string,

    @Body()
    dto:
      CaseCommentDto,
  ) {
    return this.assistanceAgentService.close(
      request.auth!.userId!,
      postId,
      caseId,
      dto,
    );
  }

  @Post(
    ':caseId/reject',
  )
  @RequirePermissions(
    'assistance.cases.update',
  )
  @AuthorizationScope({
    postParam:
      'postId',
  })
  reject(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId:
      string,

    @Param(
      'caseId',
      ParseUUIDPipe,
    )
    caseId:
      string,

    @Body()
    dto:
      RejectAssistanceCaseDto,
  ) {
    return this.assistanceAgentService.reject(
      request.auth!.userId!,
      postId,
      caseId,
      dto,
    );
  }
}