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
import { AssociationsService } from './associations.service.js';
import {
  AddAssociationMemberDto,
  UpdateAssociationMemberDto,
} from './dto/add-association-member.dto.js';
import { CreateAssociationDto } from './dto/create-association.dto.js';
import { QueryAssociationsDto } from './dto/query-associations.dto.js';
import {
  RejectAssociationDto,
  RequestCorrectionDto,
  SuspendAssociationDto,
} from './dto/review-association.dto.js';
import { UpdateAssociationDto } from './dto/update-association.dto.js';
import { UploadAssociationDocumentDto } from './dto/upload-association-doc.dto.js';

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
    sessionId?: string;
  };
};

@ApiTags('Associations & Communautés (MCA)')
@ApiBearerAuth('access-token')
@Controller('associations')
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class AssociationsController {
  constructor(private readonly associationsService: AssociationsService) {}

  /*
  |--------------------------------------------------------------------------
  | 1. Déclaration & Gestion citoyenne (Espace Diaspora)
  |--------------------------------------------------------------------------
  */

  @Post()
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.CREATE)
  @ApiOperation({
    summary: 'Créer un nouveau brouillon d’association de la diaspora',
    description:
      'Initialise le dossier, assigne le créateur comme Président/Représentant légal et le rattache au poste consulaire compétent.',
  })
  @ApiCreatedResponse({ description: 'Brouillon d’association créé.' })
  createAssociation(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAssociationDto,
  ) {
    return this.associationsService.createAssociation(request.auth!.userId!, dto);
  }

  @Get('me')
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.READ_SELF)
  @ApiOperation({
    summary: 'Lister les associations créées ou dont l’utilisateur est membre',
  })
  @ApiOkResponse({ description: 'Liste des associations de l’utilisateur.' })
  getMyAssociations(@Req() request: AuthenticatedRequest) {
    return this.associationsService.getMyAssociations(request.auth!.userId!);
  }

  @Get('directory')
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.READ_SELF, PERMISSIONS.ASSOCIATIONS.READ)
  @ApiOperation({
    summary: 'Annuaire officiel des associations camerounaises reconnues (APPROVED)',
    description: 'Recherche paginée avec filtres par pays, ville, catégorie et poste.',
  })
  @ApiOkResponse({ description: 'Résultats paginés de l’annuaire officiel.' })
  getDirectory(@Query() query: QueryAssociationsDto) {
    return this.associationsService.getDirectory(query);
  }

  /*
  |--------------------------------------------------------------------------
  | 2. File d'attente consulaire (Agent / Gestionnaire de Poste)
  |--------------------------------------------------------------------------
  */

  @Get('agent/queue')
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.READ)
  @ApiOperation({
    summary: 'File d’instruction consulaire des associations',
    description:
      'Liste paginée des dossiers en attente d’instruction ou de validation consulaire.',
  })
  @ApiOkResponse({ description: 'File d’attente consulaire.' })
  getAgentQueue(
    @Req() request: AuthenticatedRequest,
    @Query() query: QueryAssociationsDto,
  ) {
    return this.associationsService.getAgentQueue(
      null,
      false,
      query,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | 3. Consultation détaillée & Modification du dossier
  |--------------------------------------------------------------------------
  */

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.READ_SELF, PERMISSIONS.ASSOCIATIONS.READ)
  @ApiOperation({
    summary: 'Obtenir le détail exhaustif d’une association',
    description:
      'Renvoie les informations générales, le bureau, et pour les membres/agents : les pièces jointes et l’historique d’instruction.',
  })
  @ApiOkResponse({ description: 'Détail de l’association.' })
  getAssociationById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.associationsService.getAssociationById(id, request.auth?.userId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.UPDATE_SELF)
  @ApiOperation({
    summary: 'Mettre à jour les informations du dossier (Brouillon ou Correction demandée)',
  })
  @ApiOkResponse({ description: 'Dossier d’association mis à jour.' })
  updateAssociation(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateAssociationDto,
  ) {
    return this.associationsService.updateAssociation(id, request.auth!.userId!, dto);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.SUBMIT)
  @ApiOperation({
    summary: 'Soumettre officiellement le dossier d’association pour instruction consulaire',
    description:
      'Vérifie la présence des pièces obligatoires, passe le statut en SUBMITTED et notifie le poste compétent.',
  })
  @ApiOkResponse({ description: 'Dossier soumis pour instruction.' })
  submitAssociation(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.associationsService.submitAssociation(id, request.auth!.userId!);
  }

  @Post(':id/documents')
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.UPDATE_SELF)
  @ApiOperation({
    summary: 'Téléverser une pièce justificative pour l’association (statuts, récépissé, etc.)',
  })
  @ApiCreatedResponse({ description: 'Document enregistré.' })
  uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UploadAssociationDocumentDto,
  ) {
    return this.associationsService.uploadDocument(id, request.auth!.userId!, dto);
  }

  /*
  |--------------------------------------------------------------------------
  | 4. Membres & Gouvernance du bureau (Réponse directe à la demande utilisateur)
  |--------------------------------------------------------------------------
  */

  @Get(':id/members')
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.READ_SELF, PERMISSIONS.ASSOCIATIONS.READ)
  @ApiOperation({
    summary: 'Consulter tous les membres et membres du bureau de l’association',
    description:
      'Permet au Président, aux membres ou aux agents consulaires de consulter la liste intégrale des adhérents et dirigeants.',
  })
  @ApiOkResponse({ description: 'Liste des membres de l’association.' })
  getMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.associationsService.getMembers(id);
  }

  @Post(':id/members')
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.UPDATE_SELF)
  @ApiOperation({
    summary: 'Ajouter un nouveau membre ou responsable au bureau',
    description:
      'Réservé au représentant légal / président. L’utilisateur doit être inscrit sur la plateforme.',
  })
  @ApiCreatedResponse({ description: 'Membre ajouté avec succès.' })
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: AddAssociationMemberDto,
  ) {
    return this.associationsService.addMember(id, request.auth!.userId!, dto);
  }

  @Patch(':id/members/:membershipId')
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.UPDATE_SELF)
  @ApiOperation({
    summary: 'Mettre à jour le rôle ou le titre d’un membre de l’association',
  })
  @ApiOkResponse({ description: 'Membre mis à jour.' })
  updateMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateAssociationMemberDto,
  ) {
    return this.associationsService.updateMember(
      id,
      membershipId,
      request.auth!.userId!,
      dto,
    );
  }

  @Delete(':id/members/:membershipId')
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.UPDATE_SELF)
  @ApiOperation({
    summary: 'Retirer / Révoquer un membre du bureau de l’association',
  })
  @ApiOkResponse({ description: 'Membre révoqué avec succès.' })
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.associationsService.removeMember(id, membershipId, request.auth!.userId!);
  }

  /*
  |--------------------------------------------------------------------------
  | 5. Workflow de validation Consulaire & Centrale
  |--------------------------------------------------------------------------
  */

  @Post(':id/start-review')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ASSOCIATIONS.REVIEW)
  @ApiOperation({
    summary: 'Prendre en charge l’instruction d’un dossier d’association (Passe en UNDER_REVIEW)',
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
