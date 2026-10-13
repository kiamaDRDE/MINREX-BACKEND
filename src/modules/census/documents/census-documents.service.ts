import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  CensusDocumentStatus,
  CensusStatus,
} from '../../../generated/prisma/enums.js';

import {
  PrismaService,
} from '../../../infrastructure/database/prisma.service.js';

import {
  CensusDocumentStorageService,
} from './census-document-storage.service.js';

import {
  RejectCensusDocumentDto,
} from './dto/reject-census-document.dto.js';

import {
  UploadCensusDocumentDto,
} from './dto/upload-census-document.dto.js';

@Injectable()
export class CensusDocumentsService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly storage:
      CensusDocumentStorageService,
  ) {}

  async uploadMyDocument(
    userId: string,
    recordId: string,
    dto:
      UploadCensusDocumentDto,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    const record =
      await this.prisma.censusRecord.findUnique({
        where: {
          id:
            recordId,
        },

        select: {
          id: true,
          userId: true,
          status: true,
        },
      });

    if (!record) {
      throw new NotFoundException(
        'Census record not found.',
      );
    }

    if (
      record.userId !==
      userId
    ) {
      throw new ForbiddenException(
        'You cannot upload documents to another user census record.',
      );
    }

    if (
      record.status !==
        CensusStatus.DRAFT &&
      record.status !==
        CensusStatus.CORRECTION_REQUIRED
    ) {
      throw new ConflictException(
        'Documents can only be uploaded while the census record is editable.',
      );
    }

    this.validateFile(
      file,
    );

    if (
      dto.issueDate &&
      dto.expiryDate &&
      new Date(
        dto.expiryDate,
      ) <
        new Date(
          dto.issueDate,
        )
    ) {
      throw new BadRequestException(
        'Document expiry date cannot be before its issue date.',
      );
    }

    const stored =
      await this.storage.store(
        recordId,
        file,
      );

    try {
      const document =
        await this.prisma.censusDocument.create({
          data: {
            censusRecordId:
              recordId,

            type:
              dto.type,

            status:
              CensusDocumentStatus.PENDING,

            documentNumber:
              dto.documentNumber ??
              null,

            issuingCountry:
              dto.issuingCountry ??
              null,

            issueDate:
              dto.issueDate
                ? new Date(
                    dto.issueDate,
                  )
                : null,

            expiryDate:
              dto.expiryDate
                ? new Date(
                    dto.expiryDate,
                  )
                : null,

            storageKey:
              stored.storageKey,

            originalName:
              file.originalname,

            mimeType:
              file.mimetype,

            sizeBytes:
              file.size,
          },
        });

      return {
        document,
      };
    } catch (error) {
      await this.storage.remove(
        stored.storageKey,
      );

      throw error;
    }
  }

  async findMyDocuments(
    userId: string,
    recordId: string,
  ) {
    await this.ensureOwnedRecord(
      userId,
      recordId,
    );

    const items =
      await this.prisma.censusDocument.findMany({
        where: {
          censusRecordId:
            recordId,
        },

        orderBy: {
          createdAt:
            'desc',
        },
      });

    return {
      items,
    };
  }

  async getMyDocumentFile(
    userId: string,
    documentId: string,
  ) {
    const document =
      await this.prisma.censusDocument.findUnique({
        where: {
          id:
            documentId,
        },

        include: {
          censusRecord: {
            select: {
              userId:
                true,
            },
          },
        },
      });

    if (!document) {
      throw new NotFoundException(
        'Census document not found.',
      );
    }

    if (
      document.censusRecord.userId !==
      userId
    ) {
      throw new ForbiddenException(
        'You cannot access another user document.',
      );
    }

    const buffer =
      await this.storage.read(
        document.storageKey,
      );

    return {
      document,
      buffer,
    };
  }

  async getAgentDocumentFile(
    postId: string,
    documentId: string,
  ) {
    const document =
      await this.prisma.censusDocument.findFirst({
        where: {
          id:
            documentId,

          censusRecord: {
            assignedPostId:
              postId,
          },
        },
      });

    if (!document) {
      throw new NotFoundException(
        'Census document not found for this diplomatic post.',
      );
    }

    const buffer =
      await this.storage.read(
        document.storageKey,
      );

    return {
      document,
      buffer,
    };
  }

  async verifyDocument(
    postId: string,
    documentId: string,
  ) {
    const document =
      await this.findScopedDocument(
        postId,
        documentId,
      );

    if (
      document.status ===
      CensusDocumentStatus.VERIFIED
    ) {
      throw new ConflictException(
        'This document is already verified.',
      );
    }

    const updated =
      await this.prisma.censusDocument.update({
        where: {
          id:
            documentId,
        },

        data: {
          status:
            CensusDocumentStatus.VERIFIED,

          rejectionReason:
            null,
        },
      });

    return {
      document:
        updated,
    };
  }

  async rejectDocument(
    postId: string,
    documentId: string,
    dto:
      RejectCensusDocumentDto,
  ) {
    await this.findScopedDocument(
      postId,
      documentId,
    );

    const updated =
      await this.prisma.censusDocument.update({
        where: {
          id:
            documentId,
        },

        data: {
          status:
            CensusDocumentStatus.REJECTED,

          rejectionReason:
            dto.reason.trim(),
        },
      });

    return {
      document:
        updated,
    };
  }

  private async ensureOwnedRecord(
    userId: string,
    recordId: string,
  ) {
    const record =
      await this.prisma.censusRecord.findFirst({
        where: {
          id:
            recordId,

          userId,
        },

        select: {
          id:
            true,
        },
      });

    if (!record) {
      throw new NotFoundException(
        'Census record not found.',
      );
    }
  }

  private async findScopedDocument(
    postId: string,
    documentId: string,
  ) {
    const document =
      await this.prisma.censusDocument.findFirst({
        where: {
          id:
            documentId,

          censusRecord: {
            assignedPostId:
              postId,
          },
        },

        select: {
          id: true,
          status: true,
        },
      });

    if (!document) {
      throw new NotFoundException(
        'Census document not found for this diplomatic post.',
      );
    }

    return document;
  }

  private validateFile(
    file: {
      mimetype: string;
      size: number;
    },
  ) {
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
    ];

    if (
      !allowedMimeTypes.includes(
        file.mimetype,
      )
    ) {
      throw new BadRequestException(
        'Only PDF, JPEG and PNG documents are accepted.',
      );
    }

    const maxSize =
      5 * 1024 * 1024;

    if (
      file.size >
      maxSize
    ) {
      throw new BadRequestException(
        'Document size cannot exceed 5 MB.',
      );
    }
  }
}