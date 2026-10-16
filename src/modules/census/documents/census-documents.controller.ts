import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import type {
  Request,
  Response,
} from 'express';

import {
  FileInterceptor,
} from '@nestjs/platform-express';

import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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
  CensusDocumentsService,
} from './census-documents.service.js';

import {
  RejectCensusDocumentDto,
} from './dto/reject-census-document.dto.js';

import {
  UploadCensusDocumentDto,
} from './dto/upload-census-document.dto.js';

type AuthenticatedRequest =
  Request & {
    auth?: {
      userId?: string;
      sessionId?: string;
    };
  };

interface UploadedCensusFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags(
  'Census - Documents',
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
export class CensusDocumentsController {
  constructor(
    private readonly censusDocumentsService:
      CensusDocumentsService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Citizen
  |--------------------------------------------------------------------------
  */

  @Post(
    'me/:recordId/documents',
  )
  @RequirePermissions(
    'census.records.create',
  )
  @UseInterceptors(
    FileInterceptor(
      'file',
      {
        limits: {
          fileSize:
            5 *
            1024 *
            1024,
        },
      },
    ),
  )
  @ApiConsumes(
    'multipart/form-data',
  )
  @ApiBody({
    schema: {
      type:
        'object',

      required: [
        'file',
        'type',
      ],

      properties: {
        file: {
          type:
            'string',

          format:
            'binary',
        },

        type: {
          type:
            'string',

          enum: [
            'IDENTITY_DOCUMENT',
            'RESIDENCE_PROOF',
            'OTHER',
          ],
        },

        documentNumber: {
          type:
            'string',
        },

        issuingCountry: {
          type:
            'string',
        },

        issueDate: {
          type:
            'string',

          format:
            'date',
        },

        expiryDate: {
          type:
            'string',

          format:
            'date',
        },
      },
    },
  })
  @ApiOperation({
    summary:
      'Upload a census supporting document',
  })
  uploadMyDocument(
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
      UploadCensusDocumentDto,

    @UploadedFile()
    file?:
      UploadedCensusFile,
  ) {
    if (!file) {
      throw new BadRequestException(
        'A document file is required.',
      );
    }

    return this.censusDocumentsService.uploadMyDocument(
      request.auth!.userId!,
      recordId,
      dto,
      file,
    );
  }

  @Get(
    'me/:recordId/documents',
  )
  @RequirePermissions(
    'census.records.read.self',
  )
  @ApiOperation({
    summary:
      'List my census documents',
  })
  findMyDocuments(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'recordId',
      ParseUUIDPipe,
    )
    recordId:
      string,
  ) {
    return this.censusDocumentsService.findMyDocuments(
      request.auth!.userId!,
      recordId,
    );
  }

  @Get(
    'me/documents/:documentId/file',
  )
  @RequirePermissions(
    'census.records.read.self',
  )
  @ApiOperation({
    summary:
      'Download one of my census documents',
  })
  async downloadMyDocument(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'documentId',
      ParseUUIDPipe,
    )
    documentId:
      string,

    @Res()
    response:
      Response,
  ) {
    const {
      document,
      buffer,
    } =
      await this.censusDocumentsService.getMyDocumentFile(
        request.auth!.userId!,
        documentId,
      );

    response.setHeader(
      'Content-Type',
      document.mimeType ??
        'application/octet-stream',
    );

    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(
        document.originalName,
      )}"`,
    );

    response.send(
      buffer,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Agent
  |--------------------------------------------------------------------------
  */

  @Get(
    'posts/:postId/documents/:documentId/file',
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
      'Download a census document assigned to my diplomatic post',
  })
  async downloadAgentDocument(
    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId:
      string,

    @Param(
      'documentId',
      ParseUUIDPipe,
    )
    documentId:
      string,

    @Res()
    response:
      Response,
  ) {
    const {
      document,
      buffer,
    } =
      await this.censusDocumentsService.getAgentDocumentFile(
        postId,
        documentId,
      );

    response.setHeader(
      'Content-Type',
      document.mimeType ??
        'application/octet-stream',
    );

    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(
        document.originalName,
      )}"`,
    );

    response.send(
      buffer,
    );
  }

  @Post(
    'posts/:postId/documents/:documentId/verify',
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
      'Verify a census supporting document',
  })
  verifyDocument(
    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId:
      string,

    @Param(
      'documentId',
      ParseUUIDPipe,
    )
    documentId:
      string,
  ) {
    return this.censusDocumentsService.verifyDocument(
      postId,
      documentId,
    );
  }

  @Post(
    'posts/:postId/documents/:documentId/reject',
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
      'Reject a census supporting document',
  })
  rejectDocument(
    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId:
      string,

    @Param(
      'documentId',
      ParseUUIDPipe,
    )
    documentId:
      string,

    @Body()
    dto:
      RejectCensusDocumentDto,
  ) {
    return this.censusDocumentsService.rejectDocument(
      postId,
      documentId,
      dto,
    );
  }
}