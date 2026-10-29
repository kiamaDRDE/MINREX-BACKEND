import {
  describe,
  expect,
  it,
} from '@jest/globals';

import {
  resolveGeoFromCityAndCountry,
  resolveGeoFromPhoneNumber,
} from './geo-resolver.util.js';

describe('geo-resolver.util', () => {
  it('resolves exact city coordinates inside a country (Madrid, ES)', () => {
    const resolved = resolveGeoFromCityAndCountry({
      city: 'Madrid',
      iso2Code: 'ES',
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.iso2Code).toBe('ES');
    expect(resolved?.latitude).toBeCloseTo(40.4165, 1);
    expect(resolved?.longitude).toBeCloseTo(-3.7026, 1);
  });

  it('resolves country coordinates when city is omitted or French country name is passed', () => {
    const resolved = resolveGeoFromCityAndCountry({
      city: null,
      countryName: 'Espagne',
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.iso2Code).toBe('ES');
    expect(Number.isFinite(resolved?.latitude)).toBe(true);
    expect(Number.isFinite(resolved?.longitude)).toBe(true);
  });

  it('resolves user country coordinates from E.164 phone number', () => {
    const esPhone = resolveGeoFromPhoneNumber('+34612345678');
    expect(esPhone?.iso2Code).toBe('ES');

    const cmPhone = resolveGeoFromPhoneNumber('+237690123456');
    expect(cmPhone?.iso2Code).toBe('CM');
  });
});

