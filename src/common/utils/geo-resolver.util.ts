import {
  City,
  Country,
} from 'country-state-city';

import {
  parsePhoneNumberFromString,
} from 'libphonenumber-js';

export interface ResolvedGeoLocation {
  latitude: number;
  longitude: number;
  city: string | null;
  country: string;
  iso2Code: string;
}

function normalizeGeoToken(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

let countryLookupCache: Map<string, string> | null = null;
let frenchRegionNames: Intl.DisplayNames | null = null;

function getFrenchCountryLabel(
  iso2Code: string,
  fallbackName: string,
): string {
  try {
    if (!frenchRegionNames) {
      frenchRegionNames = new Intl.DisplayNames(['fr'], {
        type: 'region',
      });
    }
    return frenchRegionNames.of(iso2Code.toUpperCase()) ?? fallbackName;
  } catch {
    return fallbackName;
  }
}

function getCountryIso2Index(): Map<string, string> {
  if (countryLookupCache) {
    return countryLookupCache;
  }

  const index = new Map<string, string>();
  const enNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const frNames = new Intl.DisplayNames(['fr'], { type: 'region' });

  for (const country of Country.getAllCountries()) {
    const iso2 = country.isoCode.toUpperCase();
    index.set(normalizeGeoToken(iso2), iso2);
    index.set(normalizeGeoToken(country.name), iso2);

    const frLabel = frNames.of(iso2);
    if (frLabel) {
      index.set(normalizeGeoToken(frLabel), iso2);
    }

    const enLabel = enNames.of(iso2);
    if (enLabel) {
      index.set(normalizeGeoToken(enLabel), iso2);
    }
  }

  countryLookupCache = index;
  return index;
}

export function resolveIso2CountryCode(
  iso2OrCountryName?: string | null,
): string | null {
  if (!iso2OrCountryName) {
    return null;
  }

  const trimmed = iso2OrCountryName.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length === 2) {
    const direct = Country.getCountryByCode(trimmed.toUpperCase());
    if (direct) {
      return direct.isoCode.toUpperCase();
    }
  }

  const index = getCountryIso2Index();
  const normalized = normalizeGeoToken(trimmed);
  const exact = index.get(normalized);
  if (exact) {
    return exact;
  }

  for (const [token, iso2] of index.entries()) {
    if (token.length >= 4 && normalized.includes(token)) {
      return iso2;
    }
  }

  return null;
}

export function resolveGeoFromCityAndCountry(params: {
  city?: string | null | undefined;
  iso2Code?: string | null | undefined;
  countryName?: string | null | undefined;
  fallbackText?: string | null | undefined;
}): ResolvedGeoLocation | null {
  const iso2 =
    resolveIso2CountryCode(params.iso2Code) ??
    resolveIso2CountryCode(params.countryName) ??
    resolveIso2CountryCode(params.fallbackText);

  if (!iso2) {
    return null;
  }

  const countryRecord = Country.getCountryByCode(iso2);
  if (!countryRecord) {
    return null;
  }

  const countryFr = getFrenchCountryLabel(iso2, countryRecord.name);

  if (params.city && params.city.trim()) {
    const targetCityNorm = normalizeGeoToken(params.city);
    const cities = City.getCitiesOfCountry(iso2) ?? [];

    const exactCity =
      cities.find((c) => normalizeGeoToken(c.name) === targetCityNorm) ??
      (targetCityNorm.length >= 5
        ? cities.find((c) =>
            normalizeGeoToken(c.name).startsWith(
              targetCityNorm.slice(0, targetCityNorm.length - 1),
            ),
          )
        : undefined);

    if (exactCity?.latitude && exactCity.longitude) {
      const lat = Number(exactCity.latitude);
      const lon = Number(exactCity.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return {
          latitude: lat,
          longitude: lon,
          city: params.city.trim(),
          country: countryFr,
          iso2Code: iso2,
        };
      }
    }
  }

  const countryLat = Number(countryRecord.latitude);
  const countryLon = Number(countryRecord.longitude);
  if (Number.isFinite(countryLat) && Number.isFinite(countryLon)) {
    return {
      latitude: countryLat,
      longitude: countryLon,
      city: params.city?.trim() || null,
      country: countryFr,
      iso2Code: iso2,
    };
  }

  return null;
}

export function resolveGeoFromPhoneNumber(
  phone?: string | null,
): ResolvedGeoLocation | null {
  if (!phone) {
    return null;
  }

  const cleaned = phone.trim();
  if (!cleaned) {
    return null;
  }

  const normalizedPhone = cleaned.startsWith('00')
    ? `+${cleaned.slice(2)}`
    : cleaned.startsWith('+')
      ? cleaned
      : `+${cleaned}`;

  const parsed = parsePhoneNumberFromString(normalizedPhone);
  if (!parsed?.country) {
    return null;
  }

  return resolveGeoFromCityAndCountry({
    iso2Code: parsed.country,
  });
}

