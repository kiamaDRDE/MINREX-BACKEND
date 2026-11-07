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
import { QueryPublicationsDto } from '../dto/query-publications.dto.js';
import { ReviewPublicationDto } from '../dto/review-publication.dto.js';
import { PublicationsService } from '../publications.service.js';

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
    sessionId?: string;
  };
};

@ApiTags('Publications - Agent & Moderation Processing')
@ApiBearerAuth('access-token')
@Controller('publications/agent')
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class PublicationsAgentController {
  constructor(private readonly publicationsService: PublicationsService) {}

  @Get('queue/level1')
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.REVIEW_LEVEL1)
  @AuthorizationScope({
    allowAssignedPosts: true,
  })
  @ApiOperation({
    summary: 'File de modération Niveau 1 (Agents consulaires / modérateurs territoriaux)',
    description:
      'Liste des publications soumises en attente de vérification de premier niveau.',
  })
  @ApiOkResponse({ description: 'File Niveau 1 paginée.' })
  getLevel1Queue(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryPublicationsDto,
  ) {
    return this.publicationsService.getLevel1Queue(request.auth!.userId!, query);
  }

  @Get('queue/level2')
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.APPROVE_LEVEL2)
  @AuthorizationScope({
    allowAssignedPosts: true,
  })
  @ApiOperation({
    summary: 'File d’approbation finale Niveau 2 (Chefs de Poste / Direction Centrale MINREX)',
    description:
      'Liste des publications ayant passé le Niveau 1, en attente de visa final de publication.',
  })
  @ApiOkResponse({ description: 'File Niveau 2 paginée.' })
  getLevel2Queue(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryPublicationsDto,
  ) {
    return this.publicationsService.getLevel2Queue(request.auth!.userId!, query);
  }

  @Post(':id/review/level1')
  @AuthorizationScope({
    resource: 'publication',
    resourceIdParam: 'id',
  })
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.REVIEW_LEVEL1)
  @ApiOperation({
    summary: 'Décision Niveau 1 : Validation vers Niveau 2, demande de correction ou rejet',
  })
  @ApiOkResponse({ description: 'Décision Niveau 1 enregistrée.' })
  reviewLevel1(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReviewPublicationDto,
  ) {
    return this.publicationsService.reviewLevel1(id, request.auth!.userId!, dto);
  }

  @Post(':id/review/level2')
  @AuthorizationScope({
    resource: 'publication',
    resourceIdParam: 'id',
  })
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.APPROVE_LEVEL2)
  @ApiOperation({
    summary: 'Décision Niveau 2 : Approbation finale & mise en ligne souveraine',
  })
  @ApiOkResponse({ description: 'Décision Niveau 2 enregistrée et publication diffusée.' })
  reviewLevel2(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReviewPublicationDto,
  ) {
    return this.publicationsService.reviewLevel2(id, request.auth!.userId!, dto);
  }

  @Post(':id/feature')
  @AuthorizationScope({
    resource: 'publication',
    resourceIdParam: 'id',
  })
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.FEATURE)
  @ApiOperation({
    summary: 'Activer ou désactiver la mise à la une (Success Story / Alerte majeure)',
  })
  @ApiOkResponse({ description: 'Statut de mise en avant mis à jour.' })
  setFeatured(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Query('featured') featured: boolean = true,
  ) {
    return this.publicationsService.setFeatured(
      id,
      request.auth!.userId!,
      String(featured) === 'true',
    );
  }

  @Post(':id/archive')
  @AuthorizationScope({
    resource: 'publication',
    resourceIdParam: 'id',
  })
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.ARCHIVE)
  @ApiOperation({
    summary: 'Archiver une publication expirée ou retirée du fil d’actualités',
  })
  @ApiOkResponse({ description: 'Publication archivée.' })
  archivePublication(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.publicationsService.archivePublication(
      id,
      request.auth!.userId!,
    );
  }
}

