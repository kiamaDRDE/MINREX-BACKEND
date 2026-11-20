import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { Request } from 'express';

import { AccessTokenGuard } from '../../identity/auth/guards/access-token.guard.js';
import { PERMISSIONS } from '../../identity/authorization/constants/permissions.constants.js';
import { RequirePermissions } from '../../identity/authorization/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from '../../identity/authorization/guards/permissions.guard.js';

import { AssistanceAgentService } from '../agent/assistance-agent.service.js';
import { AdvanceStepDto } from '../agent/dto/advance-step.dto.js';
import { CaseCommentDto } from '../agent/dto/case-comment.dto.js';
import { EscalateAssistanceCaseDto } from '../agent/dto/escalate-assistance-case.dto.js';
import { ListAdminAssistanceCasesQueryDto } from '../agent/dto/list-admin-assistance-cases-query.dto.js';
import { ResolveAssistanceCaseDto } from '../agent/dto/resolve-assistance-case.dto.js';
import {
  CreateAssistanceCategoryDto,
  UpdateAssistanceCategoryDto,
} from '../dto/assistance-protocol.dto.js';
import { AssistanceProtocolsService } from '../protocols/assistance-protocols.service.js';

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
    sessionId?: string;
  };
};

@ApiTags('Assistance & Protection - Admin & Central Supervision')
@ApiBearerAuth('access-token')
@Controller('admin/assistance')
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class AssistanceAdminController {
  constructor(
    private readonly protocolsService: AssistanceProtocolsService,
    private readonly agentService: AssistanceAgentService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | PROTOCOLS CRUD (PLATFORM_ADMIN)
  |--------------------------------------------------------------------------
  */

  @Get('categories')
  @RequirePermissions(PERMISSIONS.ASSISTANCE.PROTOCOLS_MANAGE)
  @ApiOperation({
    summary: 'List all assistance protocols including inactive ones (Admin)',
  })
  @ApiOkResponse()
  listAllCategories() {
    return this.protocolsService.listCategories(true);
  }

  @Post('categories')
  @RequirePermissions(PERMISSIONS.ASSISTANCE.PROTOCOLS_MANAGE)
  @ApiOperation({
    summary: 'Create a new consular assistance protocol category and its steps',
  })
  @ApiCreatedResponse()
  createCategory(@Body() dto: CreateAssistanceCategoryDto) {
    return this.protocolsService.createCategory(dto);
  }

  @Post('categories/reset-defaults')
  @RequirePermissions(PERMISSIONS.ASSISTANCE.PROTOCOLS_MANAGE)
  @ApiOperation({
    summary: 'Restore the 7 sovereign MINREX protocols to their canonical definitions',
  })
  @ApiOkResponse()
  resetDefaults() {
    return this.protocolsService.resetSystemDefaults();
  }

  @Put('categories/:id')
  @RequirePermissions(PERMISSIONS.ASSISTANCE.PROTOCOLS_MANAGE)
  @ApiOperation({
    summary: 'Update an assistance protocol category and its operational steps',
  })
  @ApiOkResponse()
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssistanceCategoryDto,
  ) {
    return this.protocolsService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @RequirePermissions(PERMISSIONS.ASSISTANCE.PROTOCOLS_MANAGE)
  @ApiOperation({
    summary: 'Delete a custom assistance protocol category (system protocols are protected)',
  })
  @ApiOkResponse()
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.protocolsService.deleteCategory(id);
  }

  /*
  |--------------------------------------------------------------------------
  | GLOBAL ASSISTANCE CASES SUPERVISION (GLOBAL SCOPE: ADMIN / CENTRAL AGENT)
  |--------------------------------------------------------------------------
  */

  @Get('cases')
  @RequirePermissions(PERMISSIONS.ASSISTANCE.CASES_READ)
  @ApiOperation({
    summary: 'List all assistance cases across all diplomatic posts (Global supervision)',
  })
  @ApiOkResponse()
  findAllCases(@Query() query: ListAdminAssistanceCasesQueryDto) {
    return this.agentService.findAllCases(query);
  }

  @Get('cases/:caseId')
  @RequirePermissions(PERMISSIONS.ASSISTANCE.CASES_READ)
  @ApiOperation({
    summary: 'Get full details of any assistance case across the network',
  })
  @ApiOkResponse()
  findCase(@Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.agentService.findCaseById(caseId);
  }

  @Post('cases/:caseId/notes')
  @RequirePermissions(PERMISSIONS.ASSISTANCE.CASES_UPDATE)
  @ApiOperation({
    summary: 'Add a persistent consular note to an assistance case',
  })
  @ApiOkResponse()
  addNote(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CaseCommentDto,
  ) {
    return this.agentService.addNote(request.auth!.userId!, caseId, dto);
  }

  @Post('cases/:caseId/advance-step')
  @RequirePermissions(PERMISSIONS.ASSISTANCE.CASES_UPDATE)
  @ApiOperation({
    summary: 'Validate and persist the next protocol step on an assistance case',
  })
  @ApiOkResponse()
  advanceStep(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: AdvanceStepDto,
  ) {
    return this.agentService.advanceStep(request.auth!.userId!, caseId, dto);
  }

  @Post('cases/:caseId/escalate')
  @RequirePermissions(PERMISSIONS.ASSISTANCE.CASES_UPDATE)
  @ApiOperation({
    summary: 'Escalate an assistance case to central MINREX supervision (persisted in DB)',
  })
  @ApiOkResponse()
  escalateCase(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: EscalateAssistanceCaseDto,
  ) {
    return this.agentService.escalateCase(request.auth!.userId!, caseId, dto);
  }

  @Post('cases/:caseId/resolve')
  @RequirePermissions(PERMISSIONS.ASSISTANCE.CASES_UPDATE)
  @ApiOperation({
    summary: 'Resolve an assistance case from global supervision',
  })
  @ApiOkResponse()
  resolveCase(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: ResolveAssistanceCaseDto,
  ) {
    return this.agentService.resolveCaseAdmin(request.auth!.userId!, caseId, dto);
  }

  @Post('cases/:caseId/close')
  @RequirePermissions(PERMISSIONS.ASSISTANCE.CASES_CLOSE)
  @ApiOperation({
    summary: 'Close an assistance case from global supervision',
  })
  @ApiOkResponse()
  closeCase(
    @Req() request: AuthenticatedRequest,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body() dto: CaseCommentDto,
  ) {
    return this.agentService.closeCaseAdmin(request.auth!.userId!, caseId, dto);
  }
}
