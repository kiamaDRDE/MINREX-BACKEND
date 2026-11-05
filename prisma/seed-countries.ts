import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { Country as CSC } from 'country-state-city';

import { PrismaClient } from '../src/generated/prisma/client.js';

/*
|--------------------------------------------------------------------------
| TABLE DE CORRESPONDANCE OFFICIELLE ISO 3166-1 ALPHA-2 -> ALPHA-3
|--------------------------------------------------------------------------
| La dépendance 'country-state-city' fournit 'isoCode' (ISO-2), 'name' et
| 'phonecode', mais pas 'iso3Code'. Cette table standard couvre l'intégralité
| des 249+ pays et territoires reconnus pour satisfaire la contrainte unique
| 'iso3Code String @unique @db.Char(3)' de Prisma.
|--------------------------------------------------------------------------
*/

export const ISO2_TO_ISO3: Record<string, string> = {
  AD: 'AND', AE: 'ARE', AF: 'AFG', AG: 'ATG', AI: 'AIA', AL: 'ALB', AM: 'ARM',
  AO: 'AGO', AQ: 'ATA', AR: 'ARG', AS: 'ASM', AT: 'AUT', AU: 'AUS', AW: 'ABW',
  AX: 'ALA', AZ: 'AZE', BA: 'BIH', BB: 'BRB', BD: 'BGD', BE: 'BEL', BF: 'BFA',
  BG: 'BGR', BH: 'BHR', BI: 'BDI', BJ: 'BEN', BL: 'BLM', BM: 'BMU', BN: 'BRN',
  BO: 'BOL', BQ: 'BES', BR: 'BRA', BS: 'BHS', BT: 'BTN', BV: 'BVT', BW: 'BWA',
  BY: 'BLR', BZ: 'BLZ', CA: 'CAN', CC: 'CCK', CD: 'COD', CF: 'CAF', CG: 'COG',
  CH: 'CHE', CI: 'CIV', CK: 'COK', CL: 'CHL', CM: 'CMR', CN: 'CHN', CO: 'COL',
  CR: 'CRI', CU: 'CUB', CV: 'CPV', CW: 'CUW', CX: 'CXR', CY: 'CYP', CZ: 'CZE',
  DE: 'DEU', DJ: 'DJI', DK: 'DNK', DM: 'DMA', DO: 'DOM', DZ: 'DZA', EC: 'ECU',
  EE: 'EST', EG: 'EGY', EH: 'ESH', ER: 'ERI', ES: 'ESP', ET: 'ETH', FI: 'FIN',
  FJ: 'FJI', FK: 'FLK', FM: 'FSM', FO: 'FRO', FR: 'FRA', GA: 'GAB', GB: 'GBR',
  GD: 'GRD', GE: 'GEO', GF: 'GUF', GG: 'GGY', GH: 'GHA', GI: 'GIB', GL: 'GRL',
  GM: 'GMB', GN: 'GIN', GP: 'GLP', GQ: 'GNQ', GR: 'GRC', GS: 'SGS', GT: 'GTM',
  GU: 'GUM', GW: 'GNB', GY: 'GUY', HK: 'HKG', HM: 'HMD', HN: 'HND', HR: 'HRV',
  HT: 'HTI', HU: 'HUN', ID: 'IDN', IE: 'IRL', IL: 'ISR', IM: 'IMN', IN: 'IND',
  IO: 'IOT', IQ: 'IRQ', IR: 'IRN', IS: 'ISL', IT: 'ITA', JE: 'JEY', JM: 'JAM',
  JO: 'JOR', JP: 'JPN', KE: 'KEN', KG: 'KGZ', KH: 'KHM', KI: 'KIR', KM: 'COM',
  KN: 'KNA', KP: 'PRK', KR: 'KOR', KW: 'KWT', KY: 'CYM', KZ: 'KAZ', LA: 'LAO',
  LB: 'LBN', LC: 'LCA', LI: 'LIE', LK: 'LKA', LR: 'LBR', LS: 'LSO', LT: 'LTU',
  LU: 'LUX', LV: 'LVA', LY: 'LBY', MA: 'MAR', MC: 'MCO', MD: 'MDA', ME: 'MNE',
  MF: 'MAF', MG: 'MDG', MH: 'MHL', MK: 'MKD', ML: 'MLI', MM: 'MMR', MN: 'MNG',
  MO: 'MAC', MP: 'MNP', MQ: 'MTQ', MR: 'MRT', MS: 'MSR', MT: 'MLT', MU: 'MUS',
  MV: 'MDV', MW: 'MWI', MX: 'MEX', MY: 'MYS', MZ: 'MOZ', NA: 'NAM', NC: 'NCL',
  NE: 'NER', NF: 'NFK', NG: 'NGA', NI: 'NIC', NL: 'NLD', NO: 'NOR', NP: 'NPL',
  NR: 'NRU', NU: 'NIU', NZ: 'NZL', OM: 'OMN', PA: 'PAN', PE: 'PER', PF: 'PYF',
  PG: 'PNG', PH: 'PHL', PK: 'PAK', PL: 'POL', PM: 'SPM', PN: 'PCN', PR: 'PRI',
  PS: 'PSE', PT: 'PRT', PW: 'PLW', PY: 'PRY', QA: 'QAT', RE: 'REU', RO: 'ROU',
  RS: 'SRB', RU: 'RUS', RW: 'RWA', SA: 'SAU', SB: 'SLB', SC: 'SYC', SD: 'SDN',
  SE: 'SWE', SG: 'SGP', SH: 'SHN', SI: 'SVN', SJ: 'SJM', SK: 'SVK', SL: 'SLE',
  SM: 'SMR', SN: 'SEN', SO: 'SOM', SR: 'SUR', SS: 'SSD', ST: 'STP', SV: 'SLV',
  SX: 'SXM', SY: 'SYR', SZ: 'SWZ', TC: 'TCA', TD: 'TCD', TF: 'ATF', TG: 'TGO',
  TH: 'THA', TJ: 'TJK', TK: 'TKL', TL: 'TLS', TM: 'TKM', TN: 'TUN', TO: 'TON',
  TR: 'TUR', TT: 'TTO', TV: 'TUV', TW: 'TWN', TZ: 'TZA', UA: 'UKR', UG: 'UGA',
  UM: 'UMI', US: 'USA', UY: 'URY', UZ: 'UZB', VA: 'VAT', VC: 'VCT', VE: 'VEN',
  VG: 'VGB', VI: 'VIR', VN: 'VNM', VU: 'VUT', WF: 'WLF', WS: 'WSM', XK: 'XKX',
  YE: 'YEM', YT: 'MYT', ZA: 'ZAF', ZM: 'ZMB', ZW: 'ZWE',
};

/*
|--------------------------------------------------------------------------
| LOCALISATION EN FRANÇAIS (MINREX) & FORMATAGE
|--------------------------------------------------------------------------
*/

let frDisplayNames: Intl.DisplayNames | null = null;

function getLocalizedFrenchName(iso2: string, fallbackName: string): string {
  try {
    if (!frDisplayNames) {
      frDisplayNames = new Intl.DisplayNames(['fr'], { type: 'region' });
    }
    const label = frDisplayNames.of(iso2);
    if (label && label.trim()) {
      return label.trim();
    }
    return fallbackName;
  } catch {
    return fallbackName;
  }
}

function formatDialingCode(phonecode?: string | null): string | null {
  if (!phonecode || !phonecode.trim()) {
    return null;
  }
  const cleaned = phonecode.trim().replace(/^\+/, '');
  if (!cleaned) {
    return null;
  }
  const formatted = `+${cleaned}`;
  return formatted.length <= 10 ? formatted : formatted.slice(0, 10);
}

/*
|--------------------------------------------------------------------------
| FONCTION PRINCIPALE DE SEED DES PAYS
|--------------------------------------------------------------------------
*/

export async function seedCountries(client?: PrismaClient) {
  const db = client ?? getStandalonePrismaClient();

  console.log('');
  console.log('==================================================');
  console.log(' SEED DES PAYS & CODES ISO (country-state-city)');
  console.log('==================================================');

  const rawCountries = CSC.getAllCountries();
  console.log(`1. Découverte de ${rawCountries.length} pays via 'country-state-city'...`);

  const preparedCountries: Array<{
    iso2Code: string;
    iso3Code: string;
    name: string;
    dialingCode: string | null;
  }> = [];

  const registeredIso2 = new Set<string>();
  const registeredIso3 = new Set<string>();
  const registeredNames = new Set<string>();

  for (const c of rawCountries) {
    const iso2 = c.isoCode.trim().toUpperCase();
    if (iso2.length !== 2 || registeredIso2.has(iso2)) {
      continue;
    }

    // Résolution du code ISO-3
    const iso3 = ISO2_TO_ISO3[iso2] ?? `${iso2}X`;
    if (registeredIso3.has(iso3)) {
      continue;
    }

    // Résolution du nom en français avec garantie d'unicité
    let name = getLocalizedFrenchName(iso2, c.name);
    if (registeredNames.has(name)) {
      name = `${name} (${iso2})`;
    }

    const dialingCode = formatDialingCode(c.phonecode);

    registeredIso2.add(iso2);
    registeredIso3.add(iso3);
    registeredNames.add(name);

    preparedCountries.push({
      iso2Code: iso2,
      iso3Code: iso3,
      name,
      dialingCode,
    });
  }

  // Garantie que le Cameroun (siège du MINREX) est présent et prioritaire
  if (!registeredIso2.has('CM')) {
    preparedCountries.unshift({
      iso2Code: 'CM',
      iso3Code: 'CMR',
      name: 'Cameroun',
      dialingCode: '+237',
    });
  }

  console.log(`2. Synchronisation de ${preparedCountries.length} pays dans la base de données...`);

  let synchronizedCount = 0;

  for (const country of preparedCountries) {
    await db.country.upsert({
      where: { iso2Code: country.iso2Code },
      update: {
        iso3Code: country.iso3Code,
        name: country.name,
        dialingCode: country.dialingCode,
        isActive: true,
      },
      create: {
        iso2Code: country.iso2Code,
        iso3Code: country.iso3Code,
        name: country.name,
        dialingCode: country.dialingCode,
        isActive: true,
      },
    });
    synchronizedCount++;
  }

  console.log(`✅ ${synchronizedCount} pays synchronisés avec succès (ISO-2, ISO-3, Nom FR, Indicatif).`);
}

/*
|--------------------------------------------------------------------------
| STANDALONE RUNNER
|--------------------------------------------------------------------------
*/

function getStandalonePrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to seed countries.');
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  return new PrismaClient({
    adapter,
  });
}

// Exécution directe si exécuté via 'node' ou 'tsx'
const isMainModule =
  process.argv[1]?.includes('seed-countries.ts') ||
  process.argv[1]?.includes('seed-countries.js');

if (isMainModule) {
  const standaloneClient = getStandalonePrismaClient();

  standaloneClient
    .$connect()
    .then(() => seedCountries(standaloneClient))
    .then(() => {
      console.log('Seed des pays terminé avec succès.');
    })
    .catch((error: unknown) => {
      console.error('Erreur lors du seed des pays :');
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await standaloneClient.$disconnect();
    });
}

