import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, resolve as pathResolve, sep } from 'node:path';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StoredFile {
  storageKey: string;
}

@Injectable()
export class CensusDocumentStorageService {
  private readonly baseDirectory = pathResolve(
    process.cwd(),
    'storage',
    'census',
  );

  async store(
    censusRecordId: string,
    file: {
      originalname: string;
      buffer: Buffer;
    },
  ): Promise<StoredFile> {
    if (!UUID_PATTERN.test(censusRecordId)) {
      throw new BadRequestException('Invalid census record identifier.');
    }

    const extension = extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException(
        `Unsupported document file extension "${extension || 'none'}". Allowed: PDF, JPG, JPEG, PNG, WEBP.`,
      );
    }

    const recordDirectory = this.ensureWithinBase(
      join(this.baseDirectory, censusRecordId),
    );

    await mkdir(recordDirectory, { recursive: true });

    const filename = `${randomUUID()}${extension}`;
    const absolutePath = this.ensureWithinBase(join(recordDirectory, filename));

    await writeFile(absolutePath, file.buffer);

    return {
      storageKey: `${censusRecordId}/${filename}`,
    };
  }

  async read(storageKey: string) {
    const absolutePath = this.resolve(storageKey);

    try {
      await access(absolutePath);
    } catch {
      throw new NotFoundException('Stored document file not found.');
    }

    return readFile(absolutePath);
  }

  async remove(storageKey: string) {
    const absolutePath = this.resolve(storageKey);

    try {
      await unlink(absolutePath);
    } catch {
      // File may already be absent.
    }
  }

  private resolve(storageKey: string): string {
    if (
      !storageKey ||
      storageKey.includes('\0') ||
      storageKey.includes('..') ||
      isAbsolute(storageKey)
    ) {
      throw new NotFoundException('Invalid storage key.');
    }

    return this.ensureWithinBase(pathResolve(this.baseDirectory, storageKey));
  }

  private ensureWithinBase(candidatePath: string): string {
    const normalizedCandidate = pathResolve(candidatePath);
    const basePrefix = this.baseDirectory.endsWith(sep)
      ? this.baseDirectory
      : `${this.baseDirectory}${sep}`;

    if (
      normalizedCandidate !== this.baseDirectory &&
      !normalizedCandidate.startsWith(basePrefix)
    ) {
      throw new NotFoundException('Invalid storage path.');
    }

    return normalizedCandidate;
  }
}