import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';

import { SYSTEM_PERMISSIONS } from '../src/modules/identity/authorization/constants/permissions.constants.js';
import { SYSTEM_ROLES } from '../src/modules/identity/authorization/constants/system-roles.constants.js';
import { seedCountries } from './seed-countries.js';
import { seedDiplomaticNetwork } from './seed-diplomatic-network.js';

/*
|--------------------------------------------------------------------------
| DATABASE CONNECTION
|--------------------------------------------------------------------------
*/

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to run the Prisma seed.');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

/*
|--------------------------------------------------------------------------
| SEED PERMISSIONS
|--------------------------------------------------------------------------
*/

async function seedPermissions() {
  console.log('Seeding MINREX permissions...');

  for (const permission of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: {
        code: permission.code,
      },
      update: {
        name: permission.name,
        description: permission.description,
      },
      create: {
        code: permission.code,
        name: permission.name,
        description: permission.description,
      },
    });
  }

  console.log(`${SYSTEM_PERMISSIONS.length} permissions synchronized.`);
}

/*
|--------------------------------------------------------------------------
| SEED SYSTEM ROLES
|--------------------------------------------------------------------------
*/

async function seedRoles() {
  console.log('Seeding MINREX system roles...');

  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: {
        code: role.code,
      },
      update: {
        name: role.name,
        description: role.description,
        scope: role.scope,
        isSystem: role.isSystem,
        isActive: true,
      },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        scope: role.scope,
        isSystem: role.isSystem,
        isActive: true,
      },
    });
  }

  console.log(`${SYSTEM_ROLES.length} system roles synchronized.`);
}

/*
|--------------------------------------------------------------------------
| SEED ROLE <-> PERMISSION MAPPINGS
|--------------------------------------------------------------------------
*/

async function seedRolePermissions() {
  console.log('Synchronizing role permissions...');

  for (const systemRole of SYSTEM_ROLES) {
    const role = await prisma.role.findUnique({
      where: {
        code: systemRole.code,
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (!role) {
      throw new Error(`System role ${systemRole.code} was not found after seeding.`);
    }

    const permissions = await prisma.permission.findMany({
      where: {
        code: {
          in: [...systemRole.permissions],
        },
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (permissions.length !== systemRole.permissions.length) {
      const foundCodes = new Set(permissions.map((permission) => permission.code));
      const missingPermissions = systemRole.permissions.filter(
        (permissionCode) => !foundCodes.has(permissionCode),
      );

      throw new Error(
        `Missing permissions for role ${systemRole.code}: ${missingPermissions.join(', ')}`,
      );
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.rolePermission.deleteMany({
        where: {
          roleId: role.id,
        },
      });

      if (permissions.length > 0) {
        await transaction.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId: role.id,
            permissionId: permission.id,
          })),
        });
      }
    });

    console.log(`${role.code}: ${permissions.length} permissions synchronized.`);
  }
}

/*
|--------------------------------------------------------------------------
| MAIN
|--------------------------------------------------------------------------
*/

async function main() {
  console.log('');
  console.log('========================================');
  console.log(' MINREX MASTER SEED (Auth & Réseau Diplocam)');
  console.log('========================================');
  console.log('');

  await prisma.$connect();

  await seedPermissions();

  await seedRoles();

  await seedRolePermissions();

  await seedCountries(prisma);

  await seedDiplomaticNetwork(prisma);

  console.log('');
  console.log('MINREX master seed completed successfully.');
  console.log('');
}

/*
|--------------------------------------------------------------------------
| EXECUTION
|--------------------------------------------------------------------------
*/

main()
  .catch((error: unknown) => {
    console.error('MINREX master seed failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
