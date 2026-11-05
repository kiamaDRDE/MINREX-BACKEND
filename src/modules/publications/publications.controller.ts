import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { AccessTokenGuard } from '../identity/auth/guards/access-token.guard.js';
import { PERMISSIONS } from '../identity/authorization/constants/permissions.constants.js';
import { RequirePermissions } from '../identity/authorization/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from '../identity/authorization/guards/permissions.guard.js';
import { CreatePublicationDto } from './dto/create-publication.dto.js';
import { QueryPublicationsDto } from './dto/query-publications.dto.js';
import { ReviewPublicationDto } from './dto/review-publication.dto.js';
import { UpdatePublicationDto } from './dto/update-publication.dto.js';
import { PublicationsService } from './publications.service.js';

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
    sessionId?: string;
  };
};

@ApiTags('Publications, Actualités & Valorisation (MPV)')
@ApiBearerAuth('access-token')
@Controller('publications')
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class PublicationsController {
  constructor(private readonly publicationsService: PublicationsService) {}

  /*
  |--------------------------------------------------------------------------
  | 1. Fil d'actualité & Consultation publique / citoyenne
  |--------------------------------------------------------------------------
  */

  @Get('feed')
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.READ_SELF, PERMISSIONS.PUBLICATIONS.READ)
  @ApiOperation({
    summary: 'Fil d’actualités officiel et communautaire (Publications publiées)',
    description:
      'Recherche paginée, filtrable par type, portée consulaire, tag thématique ou mise à la une.',
  })
  @ApiOkResponse({ description: 'Publications publiées paginées.' })
  getFeed(@Query() query: QueryPublicationsDto) {
    return this.publicationsService.getPublicFeed(query);
  }

  @Get('me')
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.READ_SELF)
  @ApiOperation({
    summary: 'Lister les publications rédigées par l’utilisateur connecté',
    description:
      'Affiche tous les statuts (brouillons, en attente N1/N2, validées, corrections requises).',
  })
  @ApiOkResponse({ description: 'Liste des publications de l’auteur.' })
  getMyPublications(@Req() request: AuthenticatedRequest) {
    return this.publicationsService.getMyPublications(request.auth!.userId!);
  }

  /*
  |--------------------------------------------------------------------------
  | 2. Files d'instruction et modération (Niveau 1 et Niveau 2)
  |--------------------------------------------------------------------------
  */

  @Get('queue/level1')
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.REVIEW_LEVEL1)
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

  /*
  |--------------------------------------------------------------------------
  | 3. Consultation unitaire par Slug ou UUID
  |--------------------------------------------------------------------------
  */

  @Get(':identifier')
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.READ_SELF, PERMISSIONS.PUBLICATIONS.READ)
  @ApiOperation({
    summary: 'Obtenir le détail d’une publication par son slug ou son UUID',
  })
  @ApiOkResponse({ description: 'Détail de la publication.' })
  getPublication(
    @Param('identifier') identifier: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.publicationsService.getPublicationBySlugOrId(
      identifier,
      request.auth?.userId,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | 4. Rédaction & Cycle de vie citoyen / associatif
  |--------------------------------------------------------------------------
  */

  @Post()
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.CREATE)
  @ApiOperation({
    summary: 'Créer un brouillon de publication, article ou communiqué',
  })
  @ApiCreatedResponse({ description: 'Publication créée en brouillon.' })
  createPublication(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreatePublicationDto,
  ) {
    return this.publicationsService.createPublication(request.auth!.userId!, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.UPDATE_SELF)
  @ApiOperation({
    summary: 'Modifier un brouillon ou répondre à une demande de correction',
  })
  @ApiOkResponse({ description: 'Publication mise à jour.' })
  updatePublication(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdatePublicationDto,
  ) {
    return this.publicationsService.updatePublication(id, request.auth!.userId!, dto);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.SUBMIT)
  @ApiOperation({
    summary: 'Soumettre la publication pour examen au Niveau 1 (PENDING_LEVEL1_REVIEW)',
  })
  @ApiOkResponse({ description: 'Publication soumise avec succès.' })
  submitPublication(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.publicationsService.submitPublication(id, request.auth!.userId!);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.DELETE, PERMISSIONS.PUBLICATIONS.UPDATE_SELF)
  @ApiOperation({
    summary: 'Supprimer une publication (Brouillon par l’auteur ou suppression admin)',
  })
  @ApiOkResponse({ description: 'Publication supprimée.' })
  deletePublication(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.publicationsService.deletePublication(id, request.auth!.userId!);
  }

  /*
  |--------------------------------------------------------------------------
  | 5. Circuit de validation hiérarchique à deux niveaux
  |--------------------------------------------------------------------------
  */

  @Post(':id/review/level1')
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

  /*
  |--------------------------------------------------------------------------
  | 6. Actions éditoriales (Mise à la une, Archivage)
  |--------------------------------------------------------------------------
  */

  @Post(':id/feature')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.FEATURE)
  @ApiOperation({
    summary: 'Activer ou désactiver la mise à la une (Success Story / Alerte majeure)',
  })
  @ApiOkResponse({ description: 'Statut de mise en avant mis à jour.' })
  setFeatured(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('featured') featured: boolean = true,
  ) {
    return this.publicationsService.setFeatured(id, String(featured) === 'true');
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PUBLICATIONS.ARCHIVE)
  @ApiOperation({
    summary: 'Archiver une publication expirée ou retirée du fil d’actualités',
  })
  @ApiOkResponse({ description: 'Publication archivée.' })
  archivePublication(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicationsService.archivePublication(id);
  }
}

