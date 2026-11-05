import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';

/*
|--------------------------------------------------------------------------
| DATABASE CONNECTION
|--------------------------------------------------------------------------
*/

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the diplomatic network.');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

/*
|--------------------------------------------------------------------------
| TYPES DE POSTES OFFICIELS (EVISACAM)
|--------------------------------------------------------------------------
*/

export const DIPLOMATIC_POST_TYPES = [
  {
    code: 'AMBASSADE',
    name: 'Ambassade',
    description:
      'Mission diplomatique bilatérale de rang supérieur auprès d’un État étranger.',
    minCoverageCount: 1,
  },
  {
    code: 'HAUT_COMMISSARIAT',
    name: 'Haut-Commissariat',
    description:
      'Représentation diplomatique de plein exercice au sein des pays membres du Commonwealth.',
    minCoverageCount: 1,
  },
  {
    code: 'MISSION_PERMANENTE',
    name: 'Mission Permanente',
    description:
      'Représentation multilatérale auprès des Nations Unies, de l’Union Africaine ou d’organisations internationales.',
    minCoverageCount: 0,
  },
  {
    code: 'CONSULAT_GENERAL',
    name: 'Consulat Général',
    description:
      'Circonscription consulaire majeure dotée de pleines attributions consulaires et visas.',
    minCoverageCount: 1,
  },
  {
    code: 'CONSULAT',
    name: 'Consulat',
    description:
      'Poste consulaire de proximité sous la juridiction d’une ambassade ou d’un haut-commissariat.',
    minCoverageCount: 1,
  },
  {
    code: 'CONSULAT_HONORAIRE',
    name: 'Consulat Honoraire',
    description:
      'Structure consulaire bénévole d’accueil, d’orientation et de relais territorial.',
    minCoverageCount: 0,
  },
];

/*
|--------------------------------------------------------------------------
| RÉPERTOIRE DES 42 POSTES CONFIRMÉS (PassCam / MINREX)
|--------------------------------------------------------------------------
*/

export interface ConfirmedPostDefinition {
  code: string;
  name: string;
  typeCode: string;
  city: string;
  hostCountryIso2: string;
  parentPostCode?: string | null;
  coveredCountriesIso2: string[];
  address?: string;
}

export const CONFIRMED_POSTS: ConfirmedPostDefinition[] = [
  /*
  |--------------------------------------------------------------------------
  | EUROPE (12 POSTES)
  |--------------------------------------------------------------------------
  */
  {
    code: 'AMB-BERLIN',
    name: 'Ambassade du Cameroun en Allemagne',
    typeCode: 'AMBASSADE',
    city: 'Berlin',
    hostCountryIso2: 'DE',
    address: 'Ulmenallee 32, 14050 Berlin',
    coveredCountriesIso2: ['DE', 'AT', 'EE', 'LV', 'LT', 'MK', 'ME', 'PL', 'CZ'],
  },
  {
    code: 'AMB-BRUXELLES',
    name: 'Ambassade du Cameroun en Belgique (UE)',
    typeCode: 'AMBASSADE',
    city: 'Bruxelles',
    hostCountryIso2: 'BE',
    address: 'Avenue Brugmann 131-133, 1190 Bruxelles',
    coveredCountriesIso2: ['BE'],
  },
  {
    code: 'AMB-PARIS',
    name: 'Ambassade du Cameroun en France',
    typeCode: 'AMBASSADE',
    city: 'Paris',
    hostCountryIso2: 'FR',
    address: "73 Rue d'Auteuil, 75016 Paris",
    coveredCountriesIso2: ['FR', 'MC', 'PT', 'AD'],
  },
  {
    code: 'CSL-MARSEILLE',
    name: 'Consulat du Cameroun à Marseille',
    typeCode: 'CONSULAT',
    city: 'Marseille',
    hostCountryIso2: 'FR',
    parentPostCode: 'AMB-PARIS',
    address: '87 Rue Paradis, 13006 Marseille',
    coveredCountriesIso2: ['FR'],
  },
  {
    code: 'AMB-MADRID',
    name: 'Ambassade du Cameroun en Espagne',
    typeCode: 'AMBASSADE',
    city: 'Madrid',
    hostCountryIso2: 'ES',
    address: 'Calle Rosario Pino 3, 28020 Madrid',
    coveredCountriesIso2: ['ES'],
  },
  {
    code: 'AMB-ROME',
    name: 'Ambassade du Cameroun en Italie',
    typeCode: 'AMBASSADE',
    city: 'Rome',
    hostCountryIso2: 'IT',
    address: 'Via Siracusa 4, 00161 Roma',
    coveredCountriesIso2: ['IT', 'RS', 'RO', 'GR', 'MT', 'SM', 'CY'],
  },
  {
    code: 'AMB-VATICAN',
    name: 'Ambassade du Cameroun près le Saint-Siège',
    typeCode: 'AMBASSADE',
    city: 'Rome',
    hostCountryIso2: 'VA',
    address: 'Via di Porta Angelica 15, 00193 Roma',
    coveredCountriesIso2: ['VA'],
  },
  {
    code: 'AMB-LAHAYE',
    name: 'Ambassade du Cameroun aux Pays-Bas',
    typeCode: 'AMBASSADE',
    city: 'La Haye',
    hostCountryIso2: 'NL',
    address: 'Amaliastraat 14, 2514 JC Den Haag',
    coveredCountriesIso2: ['NL', 'LU'],
  },
  {
    code: 'HC-LONDRES',
    name: 'Haut-Commissariat du Cameroun au Royaume-Uni',
    typeCode: 'HAUT_COMMISSARIAT',
    city: 'Londres',
    hostCountryIso2: 'GB',
    address: '84 Holland Park, London W11 3SB',
    coveredCountriesIso2: ['GB', 'DK', 'FI', 'NO', 'SE', 'IS', 'IE'],
  },
  {
    code: 'AMB-MOSCOU',
    name: 'Ambassade du Cameroun en Fédération de Russie',
    typeCode: 'AMBASSADE',
    city: 'Moscou',
    hostCountryIso2: 'RU',
    address: 'Ulitsa Povarskaya 40, 121069 Moscow',
    coveredCountriesIso2: ['RU', 'BY', 'KZ'],
  },
  {
    code: 'AMB-BERNE',
    name: 'Ambassade du Cameroun en Suisse',
    typeCode: 'AMBASSADE',
    city: 'Berne',
    hostCountryIso2: 'CH',
    address: 'Brunnmattstrasse 22, 3007 Bern',
    coveredCountriesIso2: ['CH', 'LI'],
  },
  {
    code: 'MP-GENEVE',
    name: 'Mission Permanente du Cameroun à Genève (ONU)',
    typeCode: 'MISSION_PERMANENTE',
    city: 'Genève',
    hostCountryIso2: 'CH',
    address: 'Rue du Valais 6, 1202 Genève',
    coveredCountriesIso2: ['CH'],
  },

  /*
  |--------------------------------------------------------------------------
  | AMÉRIQUES (3 POSTES)
  |--------------------------------------------------------------------------
  */
  {
    code: 'AMB-WASHINGTON',
    name: 'Ambassade du Cameroun aux États-Unis',
    typeCode: 'AMBASSADE',
    city: 'Washington D.C.',
    hostCountryIso2: 'US',
    address: '2349 Massachusetts Ave NW, Washington, DC 20008',
    coveredCountriesIso2: ['US', 'MX', 'CR', 'BS', 'JM', 'KN', 'BZ'],
  },
  {
    code: 'HC-OTTAWA',
    name: 'Haut-Commissariat du Cameroun au Canada',
    typeCode: 'HAUT_COMMISSARIAT',
    city: 'Ottawa',
    hostCountryIso2: 'CA',
    address: '170 Clemow Ave, Ottawa, ON K1S 2B4',
    coveredCountriesIso2: ['CA'],
  },
  {
    code: 'AMB-BRASILIA',
    name: 'Ambassade du Cameroun au Brésil',
    typeCode: 'AMBASSADE',
    city: 'Brasília',
    hostCountryIso2: 'BR',
    address: 'SHIS QL 12 Conjunto 5 Casa 11, Lago Sul, Brasília - DF',
    coveredCountriesIso2: ['BR', 'AR', 'CL', 'CO', 'VE'],
  },

  /*
  |--------------------------------------------------------------------------
  | AFRIQUE (20 POSTES)
  |--------------------------------------------------------------------------
  */
  {
    code: 'HC-ABUJA',
    name: 'Haut-Commissariat du Cameroun au Nigeria',
    typeCode: 'HAUT_COMMISSARIAT',
    city: 'Abuja',
    hostCountryIso2: 'NG',
    address: 'Plot 1045, Diplomatic Zone, Central Area, Abuja',
    coveredCountriesIso2: ['NG'],
  },
  {
    code: 'CG-LAGOS',
    name: 'Consulat Général du Cameroun à Lagos',
    typeCode: 'CONSULAT_GENERAL',
    city: 'Lagos',
    hostCountryIso2: 'NG',
    parentPostCode: 'HC-ABUJA',
    address: '5 Elsie Femi Pearse St, Victoria Island, Lagos',
    coveredCountriesIso2: ['NG'],
  },
  {
    code: 'CSL-CALABAR',
    name: 'Consulat du Cameroun à Calabar',
    typeCode: 'CONSULAT',
    city: 'Calabar',
    hostCountryIso2: 'NG',
    parentPostCode: 'HC-ABUJA',
    address: '2 Marina Resort Road, Calabar, Cross River State',
    coveredCountriesIso2: ['NG'],
  },
  {
    code: 'AMB-NDJAMENA',
    name: 'Ambassade du Cameroun au Tchad',
    typeCode: 'AMBASSADE',
    city: "N'Djamena",
    hostCountryIso2: 'TD',
    address: 'Rue du Havre, BP 74, N’Djamena',
    coveredCountriesIso2: ['TD'],
  },
  {
    code: 'AMB-BANGUI',
    name: 'Ambassade du Cameroun en République Centrafricaine',
    typeCode: 'AMBASSADE',
    city: 'Bangui',
    hostCountryIso2: 'CF',
    address: 'Avenue de l’Indépendance, BP 921, Bangui',
    coveredCountriesIso2: ['CF'],
  },
  {
    code: 'AMB-BRAZZAVILLE',
    name: 'Ambassade du Cameroun en République du Congo',
    typeCode: 'AMBASSADE',
    city: 'Brazzaville',
    hostCountryIso2: 'CG',
    address: 'Boulevard Denis Sassou Nguesso, BP 2136, Brazzaville',
    coveredCountriesIso2: ['CG'],
  },
  {
    code: 'CSL-OUESSO',
    name: 'Consulat du Cameroun à Ouesso',
    typeCode: 'CONSULAT',
    city: 'Ouesso',
    hostCountryIso2: 'CG',
    parentPostCode: 'AMB-BRAZZAVILLE',
    address: 'Quartier Administratif, Ouesso, Sangha',
    coveredCountriesIso2: ['CG'],
  },
  {
    code: 'AMB-KINSHASA',
    name: 'Ambassade du Cameroun en République Démocratique du Congo',
    typeCode: 'AMBASSADE',
    city: 'Kinshasa',
    hostCountryIso2: 'CD',
    address: '171 Boulevard du 30 Juin, Gombe, Kinshasa',
    coveredCountriesIso2: ['CD', 'RW', 'BI'],
  },
  {
    code: 'AMB-MALABO',
    name: 'Ambassade du Cameroun en Guinée Équatoriale',
    typeCode: 'AMBASSADE',
    city: 'Malabo',
    hostCountryIso2: 'GQ',
    address: 'Carretera del Aeropuerto, Malabo',
    coveredCountriesIso2: ['GQ'],
  },
  {
    code: 'CSL-BATA',
    name: 'Consulat du Cameroun à Bata',
    typeCode: 'CONSULAT',
    city: 'Bata',
    hostCountryIso2: 'GQ',
    parentPostCode: 'AMB-MALABO',
    address: 'Avenida de la Libertad, Bata',
    coveredCountriesIso2: ['GQ'],
  },
  {
    code: 'AMB-LIBREVILLE',
    name: 'Ambassade du Cameroun au Gabon',
    typeCode: 'AMBASSADE',
    city: 'Libreville',
    hostCountryIso2: 'GA',
    address: 'Haut de Gué-Gué, BP 14001, Libreville',
    coveredCountriesIso2: ['GA', 'ST'],
  },
  {
    code: 'AMB-DAKAR',
    name: 'Ambassade du Cameroun au Sénégal',
    typeCode: 'AMBASSADE',
    city: 'Dakar',
    hostCountryIso2: 'SN',
    address: '157 Rue Joseph Gomis, BP 4165, Dakar',
    coveredCountriesIso2: ['SN', 'ML', 'GM', 'MR', 'CV', 'GN', 'GW'],
  },
  {
    code: 'AMB-ABIDJAN',
    name: 'Ambassade du Cameroun en Côte d’Ivoire',
    typeCode: 'AMBASSADE',
    city: 'Abidjan',
    hostCountryIso2: 'CI',
    address: 'Cocody Danga, Rue des Pêcheurs, 01 BP 2886, Abidjan 01',
    coveredCountriesIso2: ['CI', 'GH', 'TG', 'BJ', 'BF'],
  },
  {
    code: 'HC-PRETORIA',
    name: 'Haut-Commissariat du Cameroun en Afrique du Sud',
    typeCode: 'HAUT_COMMISSARIAT',
    city: 'Pretoria',
    hostCountryIso2: 'ZA',
    address: '924 Pretorius St, Arcadia, Pretoria 0083',
    coveredCountriesIso2: [
      'ZA',
      'BW',
      'KM',
      'SZ',
      'LS',
      'MW',
      'MZ',
      'NA',
      'MU',
      'MG',
      'SC',
      'TZ',
      'ZM',
      'ZW',
    ],
  },
  {
    code: 'AMB-ADDIS',
    name: 'Ambassade du Cameroun en Éthiopie (UA)',
    typeCode: 'AMBASSADE',
    city: 'Addis-Abeba',
    hostCountryIso2: 'ET',
    address: 'Bole Sub-City, Kebele 03, House No. 2311, Addis Ababa',
    coveredCountriesIso2: ['ET'],
  },
  {
    code: 'AMB-MONROVIA',
    name: 'Ambassade du Cameroun au Libéria',
    typeCode: 'AMBASSADE',
    city: 'Monrovia',
    hostCountryIso2: 'LR',
    address: 'Sinkor, Tubman Boulevard, Monrovia',
    coveredCountriesIso2: ['LR', 'SL'],
  },
  {
    code: 'CSL-NAIROBI',
    name: 'Consulat du Cameroun au Kenya (ONU-Habitat/PNUE)',
    typeCode: 'CONSULAT',
    city: 'Nairobi',
    hostCountryIso2: 'KE',
    address: 'Gigiri Court, Off UN Avenue, Nairobi',
    coveredCountriesIso2: ['KE', 'UG'],
  },
  {
    code: 'AMB-RABAT',
    name: 'Ambassade du Cameroun au Maroc',
    typeCode: 'AMBASSADE',
    city: 'Rabat',
    hostCountryIso2: 'MA',
    address: 'Avenue Mehdi Ben Barka, Souissi, Rabat',
    coveredCountriesIso2: ['MA'],
  },
  {
    code: 'AMB-ALGER',
    name: 'Ambassade du Cameroun en Algérie',
    typeCode: 'AMBASSADE',
    city: 'Alger',
    hostCountryIso2: 'DZ',
    address: '27 Chemin Abdelkader Gadouche, Hydra, Alger',
    coveredCountriesIso2: ['DZ'],
  },
  {
    code: 'AMB-TUNIS',
    name: 'Ambassade du Cameroun en Tunisie',
    typeCode: 'AMBASSADE',
    city: 'Tunis',
    hostCountryIso2: 'TN',
    address: '3 Rue Kheireddine Pacha, Mutuelleville, 1082 Tunis',
    coveredCountriesIso2: ['TN'],
  },
  {
    code: 'AMB-LECAIRE',
    name: 'Ambassade du Cameroun en Égypte',
    typeCode: 'AMBASSADE',
    city: 'Le Caire',
    hostCountryIso2: 'EG',
    address: '15 Mohamed Mazhar St, Zamalek, Cairo',
    coveredCountriesIso2: ['EG', 'SD', 'LY', 'JO', 'LB'],
  },

  /*
  |--------------------------------------------------------------------------
  | ASIE ET MOYEN-ORIENT (7 POSTES)
  |--------------------------------------------------------------------------
  */
  {
    code: 'AMB-PEKIN',
    name: 'Ambassade du Cameroun en Chine',
    typeCode: 'AMBASSADE',
    city: 'Pékin',
    hostCountryIso2: 'CN',
    address: '7 Sanlitun Dongwujie, Chaoyang District, Beijing 100600',
    coveredCountriesIso2: ['CN', 'MN', 'KP'],
  },
  {
    code: 'AMB-TOKYO',
    name: 'Ambassade du Cameroun au Japon',
    typeCode: 'AMBASSADE',
    city: 'Tokyo',
    hostCountryIso2: 'JP',
    address: '3-27-16 Nozawa, Setagaya-ku, Tokyo 154-0003',
    coveredCountriesIso2: ['JP', 'KR', 'AU', 'NZ', 'SG'],
  },
  {
    code: 'AMB-ANKARA',
    name: 'Ambassade du Cameroun en Turquie',
    typeCode: 'AMBASSADE',
    city: 'Ankara',
    hostCountryIso2: 'TR',
    address: 'Gaziosmanpaşa, Ilkbahar Mah. 612. Sok. No:10, Çankaya, Ankara',
    coveredCountriesIso2: ['TR', 'GE', 'AZ'],
  },
  {
    code: 'AMB-RIYAD',
    name: 'Ambassade du Cameroun en Arabie Saoudite',
    typeCode: 'AMBASSADE',
    city: 'Riyad',
    hostCountryIso2: 'SA',
    address: 'Diplomatic Quarter, P.O. Box 94361, Riyadh 11693',
    coveredCountriesIso2: ['SA', 'KW', 'BH', 'OM'],
  },
  {
    code: 'CG-DJEDDAH',
    name: 'Consulat Général du Cameroun à Djeddah',
    typeCode: 'CONSULAT_GENERAL',
    city: 'Djeddah',
    hostCountryIso2: 'SA',
    parentPostCode: 'AMB-RIYAD',
    address: 'Al-Rehab District, Jeddah',
    coveredCountriesIso2: ['SA'],
  },
  {
    code: 'CG-DUBAI',
    name: 'Consulat Général du Cameroun à Dubaï',
    typeCode: 'CONSULAT_GENERAL',
    city: 'Dubaï',
    hostCountryIso2: 'AE',
    address: 'Al Hudaiba, Bur Dubai, Dubai',
    coveredCountriesIso2: ['AE', 'QA'],
  },
  {
    code: 'AMB-TELAVIV',
    name: 'Ambassade du Cameroun en Israël',
    typeCode: 'AMBASSADE',
    city: 'Tel Aviv',
    hostCountryIso2: 'IL',
    address: 'Beit Silver, 7 Abba Hillel Silver Rd, Ramat Gan 5252204',
    coveredCountriesIso2: ['IL'],
  },
];

/*
|--------------------------------------------------------------------------
| SEED FUNCTION
|--------------------------------------------------------------------------
*/

export async function seedDiplomaticNetwork(client?: PrismaClient) {
  const db = client ?? prisma;

  console.log('');
  console.log('==================================================');
  console.log(' SEED DU RÉSEAU DIPLOMATIQUE DU CAMEROUN (PassCam)');
  console.log('==================================================');
  console.log('');

  // 1. Synchronisation des Types de Postes
  console.log('1. Synchronisation des types de postes...');
  const postTypesMap = new Map<string, string>();

  for (const pType of DIPLOMATIC_POST_TYPES) {
    const postType = await db.postType.upsert({
      where: { code: pType.code },
      update: {
        name: pType.name,
        description: pType.description,
        minCoverageCount: pType.minCoverageCount,
        isActive: true,
      },
      create: {
        code: pType.code,
        name: pType.name,
        description: pType.description,
        minCoverageCount: pType.minCoverageCount,
        isActive: true,
      },
    });

    postTypesMap.set(postType.code, postType.id);
  }

  console.log(`   ${DIPLOMATIC_POST_TYPES.length} types de postes synchronisés.`);

  // 2. Indexation des Pays existants par code ISO-2
  console.log('2. Indexation des pays...');
  const existingCountries = await db.country.findMany({
    select: { id: true, iso2Code: true, name: true },
  });

  const countryByIso2 = new Map<string, { id: string; name: string }>();
  for (const c of existingCountries) {
    countryByIso2.set(c.iso2Code.toUpperCase(), { id: c.id, name: c.name });
  }

  console.log(`   ${countryByIso2.size} pays indexés dans la base.`);

  // 3. Création des Postes Racines (sans parent)
  console.log('3. Synchronisation des 42 postes diplomatiques...');
  const postsMap = new Map<string, string>();

  // Passe 1 : Créer ou mettre à jour tous les postes sans parent
  for (const p of CONFIRMED_POSTS) {
    const typeId = postTypesMap.get(p.typeCode);
    if (!typeId) {
      throw new Error(`Type de poste inconnu: ${p.typeCode}`);
    }

    const hostCountry = countryByIso2.get(p.hostCountryIso2.toUpperCase());
    const hostCountryId = hostCountry?.id ?? null;

    const post = await db.diplomaticPost.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        typeId,
        city: p.city,
        address: p.address,
        hostCountryId,
        status: 'ACTIVE',
      },
      create: {
        code: p.code,
        name: p.name,
        typeId,
        city: p.city,
        address: p.address,
        hostCountryId,
        status: 'ACTIVE',
      },
    });

    postsMap.set(post.code, post.id);
  }

  // Passe 2 : Lier les postes enfants à leur poste parent hiérarchique
  console.log('4. Résolution des liens hiérarchiques (Postes parents)...');
  let hierarchyCount = 0;
  for (const p of CONFIRMED_POSTS) {
    if (p.parentPostCode) {
      const parentId = postsMap.get(p.parentPostCode);
      const childId = postsMap.get(p.code);

      if (parentId && childId) {
        await db.diplomaticPost.update({
          where: { id: childId },
          data: { parentPostId: parentId },
        });
        hierarchyCount++;
      }
    }
  }
  console.log(`   ${hierarchyCount} relations hiérarchiques parent-enfant configurées.`);

  // 4. Synchronisation des Couvertures Territoriales (PostCoverage)
  console.log('5. Synchronisation des compétences territoriales et juridictions...');
  let coverageCount = 0;

  for (const p of CONFIRMED_POSTS) {
    const postId = postsMap.get(p.code);
    if (!postId) continue;

    for (const countryIso of p.coveredCountriesIso2) {
      const country = countryByIso2.get(countryIso.toUpperCase());
      if (!country) {
        console.warn(
          `   [Avertissement] Pays ISO "${countryIso}" non trouvé pour le poste ${p.code}`,
        );
        continue;
      }

      const existingCoverage = await db.postCoverage.findFirst({
        where: {
          postId,
          countryId: country.id,
        },
      });

      if (existingCoverage) {
        await db.postCoverage.update({
          where: {
            id: existingCoverage.id,
          },
          data: {
            competenceNature: 'JURIDICTION_CONSULAIRE',
          },
        });
      } else {
        await db.postCoverage.create({
          data: {
            postId,
            countryId: country.id,
            competenceNature: 'JURIDICTION_CONSULAIRE',
          },
        });
      }

      coverageCount++;
    }
  }

  console.log(`   ${coverageCount} juridictions consulaires territoriales synchronisées.`);
  console.log('');
  console.log('Réseau diplomatique synchronisé avec succès !');
  console.log('==================================================');
  console.log('');
}

/*
|--------------------------------------------------------------------------
| MAIN EXECUTION
|--------------------------------------------------------------------------
*/

if (process.argv[1]?.includes('seed-diplomatic-network')) {
  seedDiplomaticNetwork()
    .catch((error) => {
      console.error('Erreur lors du seed du réseau diplomatique :', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

