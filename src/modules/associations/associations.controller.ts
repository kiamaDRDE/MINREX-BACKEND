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
import { UpdateAssociationDto } from './dto/update-association.dto.js';
import { UploadAssociationDocumentDto } from './dto/upload-association-doc.dto.js';
import { AuthorizationScope } from '../identity/authorization/decorators/authorization-scope.decorator.js';
import { RequireAnyPermissions } from '../identity/authorization/decorators/require-any-permissions.decorator.js';

type AuthenticatedRequest = Request & {
  auth?: {
    userId?: string;
    sessionId?: string;
  };
};

@ApiTags('Associations & Communautés (MCA) - Espace Citoyen & Annuaire')
@ApiBearerAuth('access-token')
@Controller('associations')
@UseGuards(AccessTokenGuard, PermissionsGuard)
export class AssociationsController {
  constructor(private readonly associationsService: AssociationsService) {}

  /*
  |--------------------------------------------------------------------------
  | 1. Déclaration & Consultation citoyenne (Espace Diaspora)
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
  @RequireAnyPermissions(
    PERMISSIONS.ASSOCIATIONS.READ_SELF,
    PERMISSIONS.ASSOCIATIONS.READ,
  )
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
  | 2. Consultation détaillée & Modification du dossier
  |--------------------------------------------------------------------------
  */

  @Get(':id')
  @RequireAnyPermissions(
    PERMISSIONS.ASSOCIATIONS.READ_SELF,
    PERMISSIONS.ASSOCIATIONS.READ,
  )
  @AuthorizationScope({
    resource: 'association',
    resourceIdParam: 'id',
  })
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
  | 3. Membres & Gouvernance du bureau
  |--------------------------------------------------------------------------
  */

  @Get(':id/members')
  @RequireAnyPermissions(
    PERMISSIONS.ASSOCIATIONS.READ_SELF,
    PERMISSIONS.ASSOCIATIONS.READ,
  )
  @AuthorizationScope({
    resource: 'association',
    resourceIdParam: 'id',
  })
  @ApiOperation({
    summary: 'Consulter tous les membres et membres du bureau de l’association',
    description:
      'Permet au Président, aux membres ou aux agents consulaires de consulter la liste intégrale des adhérents et dirigeants.',
  })
  @ApiOkResponse({ description: 'Liste des membres de l’association.' })
  getMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.associationsService.getMembers(
      id,
      request.auth!.userId!,
    );
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
}
