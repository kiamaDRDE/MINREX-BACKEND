import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import type { Request } from 'express';
import { AccessTokenGuard } from '../../identity/auth/guards/access-token.guard.js';
import { PERMISSIONS } from '../../identity/authorization/constants/permissions.constants.js';
import { RequirePermissions } from '../../identity/authorization/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from '../../identity/authorization/guards/permissions.guard.js';
import { AuthorizationScope } from '../../identity/authorization/decorators/authorization-scope.decorator.js';
import { AssociationsService } from '../associations.service.js';
import { QueryAssociationsDto } from '../dto/query-associations.dto.js';
import {
  RejectAssociationDto,
  RequestCorrectionDto,
  SuspendAssociationDto,
} from '../dto/review-association.dto.js';

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
    sessionId?: string;
  };
};

@ApiTags('Associations - Agent & Consular Processing')
@ApiBearerAuth('access-token')
@Controller('associations/agent')
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class AssociationsAgentController {
  constructor(private readonly associationsService: AssociationsService) {}

  @Get('queue')
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.READ)
  @AuthorizationScope({
    allowAssignedPosts: true,
  })
  @ApiOperation({
    summary: 'File d’instruction consulaire des associations',
    description:
      'Liste paginée des dossiers en attente d’instruction ou de validation consulaire pour les postes assignés à l’agent.',
  })
  @ApiOkResponse({ description: 'File d’attente consulaire.' })
  getAgentQueue(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryAssociationsDto,
  ) {
    return this.associationsService.getAgentQueue(
      request.auth!.userId!,
      query,
    );
  }

  @Post(':id/start-review')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.REVIEW)
  @AuthorizationScope({
    resource: 'association',
    resourceIdParam: 'id',
  })
  @ApiOperation({
    summary: 'Prendre en charge l’instruction d’un dossier d’association (UNDER_REVIEW)',
  })
  @ApiOkResponse({ description: 'Dossier pris en charge.' })
  startReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.associationsService.startReview(id, request.auth!.userId!);
  }

  @Post(':id/request-correction')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.REQUEST_CORRECTION)
  @AuthorizationScope({
    resource: 'association',
    resourceIdParam: 'id',
  })
  @ApiOperation({
    summary: 'Demander un complément ou une correction motivée au déclarant (CORRECTION_REQUIRED)',
  })
  @ApiOkResponse({ description: 'Demande de correction transmise au déclarant.' })
  requestCorrection(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: RequestCorrectionDto,
  ) {
    return this.associationsService.requestCorrection(id, request.auth!.userId!, dto);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.APPROVE)
  @AuthorizationScope({
    resource: 'association',
    resourceIdParam: 'id',
  })
  @ApiOperation({
    summary: 'Valider et certifier officiellement l’association (APPROVED)',
    description:
      'Accorde la certification consulaire numérique et publie l’association dans l’annuaire officiel.',
  })
  @ApiOkResponse({ description: 'Association approuvée et certifiée.' })
  approveAssociation(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.associationsService.approveAssociation(id, request.auth!.userId!);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.REJECT)
  @AuthorizationScope({
    resource: 'association',
    resourceIdParam: 'id',
  })
  @ApiOperation({
    summary: 'Rejeter définitivement la demande d’enregistrement avec motif légal (REJECTED)',
  })
  @ApiOkResponse({ description: 'Association rejetée.' })
  rejectAssociation(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: RejectAssociationDto,
  ) {
    return this.associationsService.rejectAssociation(id, request.auth!.userId!, dto);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.SUSPEND)
  @AuthorizationScope({
    resource: 'association',
    resourceIdParam: 'id',
  })
  @ApiOperation({
    summary: 'Suspendre administrativement une association certifiée (SUSPENDED)',
  })
  @ApiOkResponse({ description: 'Association suspendue administrativement.' })
  suspendAssociation(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: SuspendAssociationDto,
  ) {
    return this.associationsService.suspendAssociation(id, request.auth!.userId!, dto);
  }
}

