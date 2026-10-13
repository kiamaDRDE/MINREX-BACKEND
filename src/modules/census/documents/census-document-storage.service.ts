import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  randomUUID,
} from 'node:crypto';

import {
  access,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';

import {
  extname,
  join,
} from 'node:path';

interface StoredFile {
  storageKey: string;
}

@Injectable()
export class CensusDocumentStorageService {
  private readonly baseDirectory =
    join(
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
    const recordDirectory =
      join(
        this.baseDirectory,
        censusRecordId,
      );

    await mkdir(
      recordDirectory,
      {
        recursive: true,
      },
    );

    const extension =
      extname(
        file.originalname,
      ).toLowerCase();

    const filename =
      `${randomUUID()}${extension}`;

    const absolutePath =
      join(
        recordDirectory,
        filename,
      );

    await writeFile(
      absolutePath,
      file.buffer,
    );

    return {
      storageKey:
        `${censusRecordId}/${filename}`,
    };
  }

  async read(
    storageKey: string,
  ) {
    const absolutePath =
      this.resolve(
        storageKey,
      );

    try {
      await access(
        absolutePath,
      );
    } catch {
      throw new NotFoundException(
        'Stored document file not found.',
      );
    }

    return readFile(
      absolutePath,
    );
  }

  async remove(
    storageKey: string,
  ) {
    const absolutePath =
      this.resolve(
        storageKey,
      );

    try {
      await unlink(
        absolutePath,
      );
    } catch {
      // File may already be absent.
    }
  }

  private resolve(
    storageKey: string,
  ) {
    if (
      storageKey.includes(
        '..',
      )
    ) {
      throw new NotFoundException(
        'Invalid storage key.',
      );
    }

    return join(
      this.baseDirectory,
      storageKey,
    );
  }
}