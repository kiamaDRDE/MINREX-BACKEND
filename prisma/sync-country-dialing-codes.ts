import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import {
  getCountryCallingCode,
  isSupportedCountry,
} from 'libphonenumber-js';

import type {
  CountryCode,
} from 'libphonenumber-js';

import {
  PrismaClient,
} from '../src/generated/prisma/client.js';

/*
|--------------------------------------------------------------------------
| DATABASE CONNECTION
|--------------------------------------------------------------------------
*/

const connectionString =
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is required.',
  );
}

const adapter =
  new PrismaPg({
    connectionString,
  });

const prisma =
  new PrismaClient({
    adapter,
  });

/*
|--------------------------------------------------------------------------
| SYNCHRONIZE COUNTRY DIALING CODES
|--------------------------------------------------------------------------
*/

async function main() {
  const countries =
    await prisma.country.findMany({
      select: {
        id: true,
        iso2Code: true,
        name: true,
        dialingCode: true,
      },

      orderBy: {
        name: 'asc',
      },
    });

  let updatedCount = 0;
  let skippedCount = 0;

  for (const country of countries) {
    const iso2Code =
      country.iso2Code
        .trim()
        .toUpperCase() as CountryCode;

    if (
      !isSupportedCountry(
        iso2Code,
      )
    ) {
      console.warn(
        `Skipped ${country.name} (${country.iso2Code}): unsupported ISO-2 country code.`,
      );

      skippedCount += 1;

      continue;
    }

    const dialingCode =
      `+${getCountryCallingCode(
        iso2Code,
      )}`;

    if (
      country.dialingCode ===
      dialingCode
    ) {
      continue;
    }

    await prisma.country.update({
      where: {
        id: country.id,
      },

      data: {
        dialingCode,
      },
    });

    console.log(
      `${country.name} (${iso2Code}) -> ${dialingCode}`,
    );

    updatedCount += 1;
  }

  console.log('');
  console.log(
    `${updatedCount} country dialing codes updated.`,
  );

  console.log(
    `${skippedCount} countries skipped.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      'Country dialing-code synchronization failed.',
    );

    console.error(
      error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });