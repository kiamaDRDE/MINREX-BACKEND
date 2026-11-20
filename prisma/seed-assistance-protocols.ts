import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { DEFAULT_ASSISTANCE_PROTOCOLS } from '../src/modules/assistance/constants/default-assistance-protocols.constants.js';

export async function seedAssistanceProtocols(db: PrismaClient): Promise<number> {
  console.log('Seeding MINREX sovereign assistance protocols...');

  let syncedCount = 0;

  for (const protocol of DEFAULT_ASSISTANCE_PROTOCOLS) {
    await db.$transaction(async (tx) => {
      const category = await tx.assistanceCategory.upsert({
        where: { code: protocol.code },
        update: {
          name: protocol.name,
          shortName: protocol.shortName,
          categoryGroup: protocol.categoryGroup,
          description: protocol.description,
          legalNotice: protocol.legalNotice,
          icon: protocol.icon,
          badgeColor: protocol.badgeColor,
          defaultUrgency: protocol.defaultUrgency,
          defaultSlaHours: protocol.defaultSlaHours,
          isSystem: true,
          isActive: true,
          displayOrder: protocol.displayOrder,
        },
        create: {
          code: protocol.code,
          name: protocol.name,
          shortName: protocol.shortName,
          categoryGroup: protocol.categoryGroup,
          description: protocol.description,
          legalNotice: protocol.legalNotice,
          icon: protocol.icon,
          badgeColor: protocol.badgeColor,
          defaultUrgency: protocol.defaultUrgency,
          defaultSlaHours: protocol.defaultSlaHours,
          isSystem: true,
          isActive: true,
          displayOrder: protocol.displayOrder,
        },
      });

      await tx.assistanceProtocolStep.deleteMany({
        where: { categoryId: category.id },
      });

      if (protocol.steps.length > 0) {
        await tx.assistanceProtocolStep.createMany({
          data: protocol.steps.map((step) => ({
            categoryId: category.id,
            stepNumber: step.stepNumber,
            title: step.title,
            description: step.description,
            recommendedDelay: step.recommendedDelay,
            responsibleRole: step.responsibleRole,
            requiredDocs: step.requiredDocs,
          })),
        });
      }
    });

    syncedCount += 1;
  }

  console.log(`${syncedCount} assistance protocols synchronized.`);
  return syncedCount;
}

if (process.argv[1]?.includes('seed-assistance-protocols')) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to seed assistance protocols.');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  seedAssistanceProtocols(prisma)
    .catch((error) => {
      console.error('Error seeding assistance protocols:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
