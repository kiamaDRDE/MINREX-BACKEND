import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { NetworkService } from './network.service.js';

describe('NetworkService', () => {
  const prismaMock = {
    country: {
      findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    postType: {
      findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    diplomaticPost: {
      findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    service: {
      findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    postCoverage: {
      findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
  };

  let service: NetworkService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NetworkService(prismaMock as unknown as PrismaService);
  });

  it('findPosts returns services, coverages, parentPostId and auto-resolves coordinates safely', async () => {
    prismaMock.diplomaticPost.findMany.mockResolvedValue([
      {
        id: 'post-paris',
        code: 'AMB-PARIS',
        name: 'Ambassade du Cameroun en France',
        status: 'ACTIVE',
        typeId: 'type-amb',
        hostCountryId: 'country-fr',
        parentPostId: null,
        city: 'Paris',
        address: "73 Rue d'Auteuil, 75016 Paris",
        latitude: null,
        longitude: null,
        openedAt: null,
        closedAt: null,
        type: { id: 'type-amb', code: 'AMBASSADE', name: 'Ambassade' },
        hostCountry: { id: 'country-fr', iso2Code: 'FR', iso3Code: 'FRA', name: 'France' },
        parentPost: null,
        services: [
          {
            id: 'srv-1',
            postId: 'post-paris',
            code: 'VISA',
            name: 'Service des Visas',
            serviceType: 'CONSULAR_VISAS',
            description: 'Visas',
            status: 'ACTIVE',
          },
        ],
        coverages: [
          {
            id: 'cov-1',
            postId: 'post-paris',
            countryId: 'country-fr',
            competenceNature: 'DIPLOMATIC_AND_CONSULAR',
            startDate: new Date('2026-01-01'),
            endDate: null,
            country: { id: 'country-fr', iso2Code: 'FR', iso3Code: 'FRA', name: 'France' },
          },
        ],
      },
    ]);
    // Even if lazy DB coordinate backfill fails, findPosts must still succeed
    prismaMock.diplomaticPost.update.mockRejectedValue(new Error('transient lock'));

    const result = await service.findPosts();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.services).toHaveLength(1);
    expect(result.items[0]?.coverages).toHaveLength(1);
    expect(result.items[0]?.latitude).not.toBeNull();
    expect(result.items[0]?.longitude).not.toBeNull();
    expect(prismaMock.diplomaticPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 500,
        select: expect.objectContaining({
          parentPostId: true,
          services: expect.anything(),
          coverages: expect.anything(),
        }),
      }),
    );
  });

  it('createCountry rejects duplicate country with ConflictException', async () => {
    prismaMock.country.findFirst.mockResolvedValue({ id: 'country-fr' });

    await expect(
      service.createCountry({ iso2Code: 'FR', iso3Code: 'FRA', name: 'France' }),
    ).rejects.toThrow(ConflictException);
  });

  it('createPostType rejects duplicate code or name with ConflictException', async () => {
    prismaMock.postType.findFirst.mockResolvedValue({ id: 'type-1' });

    await expect(
      service.createPostType({ code: 'AMBASSADE', name: 'Ambassade' }),
    ).rejects.toThrow(ConflictException);
  });

  it('createPost rejects duplicate post code with ConflictException', async () => {
    prismaMock.postType.findUnique.mockResolvedValue({ id: 'type-1', isActive: true });
    prismaMock.diplomaticPost.findUnique.mockResolvedValue({ id: 'existing-post' });

    await expect(
      service.createPost({
        code: 'AMB-PARIS',
        name: 'Ambassade du Cameroun en France',
        typeId: 'type-1',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('updatePost rejects self-parenting and indirect hierarchy cycles', async () => {
    const existingPost = {
      id: 'post-a',
      code: 'AMB-A',
      name: 'Post A',
      typeId: 'type-1',
      hostCountryId: null,
      parentPostId: null,
      city: 'Paris',
      address: null,
      latitude: 48.85,
      longitude: 2.35,
      status: 'ACTIVE',
    };

    prismaMock.diplomaticPost.findUnique.mockResolvedValueOnce(existingPost);

    await expect(
      service.updatePost('post-a', { parentPostId: 'post-a' }),
    ).rejects.toThrow(BadRequestException);

    // Indirect cycle: post-a -> parent post-b -> parent post-a
    prismaMock.diplomaticPost.findUnique
      .mockResolvedValueOnce(existingPost) // find existing post-a
      .mockResolvedValueOnce({ id: 'post-b' }) // validatePostReferences parent exists
      .mockResolvedValueOnce({ parentPostId: 'post-a' }); // ancestor walk finds post-a!
    prismaMock.postType.findUnique.mockResolvedValue({ id: 'type-1', isActive: true });

    await expect(
      service.updatePost('post-a', { parentPostId: 'post-b' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('updatePost allows detaching a subordinate post by passing parentPostId: null', async () => {
    prismaMock.diplomaticPost.findUnique.mockResolvedValue({
      id: 'post-child',
      code: 'CSL-MARSEILLE',
      name: 'Consulat à Marseille',
      typeId: 'type-csl',
      hostCountryId: 'country-fr',
      parentPostId: 'post-paris',
      city: 'Marseille',
      address: null,
      latitude: 43.29,
      longitude: 5.36,
      status: 'ACTIVE',
    });
    prismaMock.postType.findUnique.mockResolvedValue({ id: 'type-csl', isActive: true });
    prismaMock.country.findUnique.mockResolvedValue({ id: 'country-fr', isActive: true });
    prismaMock.diplomaticPost.update.mockResolvedValue({
      id: 'post-child',
      code: 'CSL-MARSEILLE',
      name: 'Consulat à Marseille',
      parentPostId: null,
      latitude: 43.29,
      longitude: 5.36,
      status: 'ACTIVE',
    });

    const res = await service.updatePost('post-child', { parentPostId: null });

    expect(res.post.parentPostId).toBeNull();
    expect(prismaMock.diplomaticPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentPostId: null }),
      }),
    );
  });

  it('createService rejects duplicate code within the same post', async () => {
    prismaMock.diplomaticPost.findUnique.mockResolvedValue({ id: 'post-1' });
    prismaMock.service.findFirst.mockResolvedValue({ id: 'srv-existing' });

    await expect(
      service.createService('post-1', { code: 'VISA', name: 'Visas' }),
    ).rejects.toThrow(ConflictException);
  });

  it('createCoverage validates active country, date order, and duplicate active coverage', async () => {
    prismaMock.diplomaticPost.findUnique.mockResolvedValue({ id: 'post-1' });
    prismaMock.country.findUnique.mockResolvedValueOnce({ id: 'country-1', isActive: false });

    await expect(
      service.createCoverage('post-1', { countryId: 'country-1' }),
    ).rejects.toThrow(BadRequestException);

    prismaMock.country.findUnique.mockResolvedValueOnce({ id: 'country-1', isActive: true });
    await expect(
      service.createCoverage('post-1', {
        countryId: 'country-1',
        startDate: '2026-06-01',
        endDate: '2026-05-01',
      }),
    ).rejects.toThrow(BadRequestException);

    prismaMock.country.findUnique.mockResolvedValueOnce({ id: 'country-1', isActive: true });
    prismaMock.postCoverage.findFirst.mockResolvedValueOnce({ id: 'cov-active' });
    await expect(
      service.createCoverage('post-1', { countryId: 'country-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('updateCoverage throws NotFoundException when coverage does not exist and rejects endDate before startDate', async () => {
    prismaMock.postCoverage.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updateCoverage('cov-missing', { endDate: '2026-12-31' }),
    ).rejects.toThrow(NotFoundException);

    prismaMock.postCoverage.findUnique.mockResolvedValueOnce({
      id: 'cov-1',
      startDate: new Date('2026-06-01'),
    });
    await expect(
      service.updateCoverage('cov-1', { endDate: '2026-01-01' }),
    ).rejects.toThrow(BadRequestException);
  });
});
