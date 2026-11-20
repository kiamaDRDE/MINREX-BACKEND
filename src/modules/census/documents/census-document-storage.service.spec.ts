import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import { CensusDocumentStorageService } from './census-document-storage.service.js';

describe('CensusDocumentStorageService', () => {
  const service = new CensusDocumentStorageService();

  it('rejects non-UUID record identifiers and unsafe file extensions', async () => {
    await expect(
      service.store('../escape', {
        originalname: 'passport.pdf',
        buffer: Buffer.from('pdf'),
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.store('550e8400-e29b-41d4-a716-446655440000', {
        originalname: 'evil.html',
        buffer: Buffer.from('<script>alert(1)</script>'),
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.store('550e8400-e29b-41d4-a716-446655440000', {
        originalname: 'payload.svg',
        buffer: Buffer.from('<svg />'),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks path traversal, absolute paths and null bytes when reading', async () => {
    await expect(service.read('../.env')).rejects.toThrow(NotFoundException);
    await expect(service.read('/etc/passwd')).rejects.toThrow(NotFoundException);
    await expect(service.read('abc\0.pdf')).rejects.toThrow(NotFoundException);
  });
});

