import { BadRequestException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { jest } from '@jest/globals';

import { HttpExceptionFilter } from './http-exception.filter.js';

function createMockHost(overrides?: {
  method?: string;
  originalUrl?: string;
  requestId?: string;
}) {
  const jsonMock = jest.fn();
  const statusMock = jest.fn(() => ({ json: jsonMock }));
  const request = {
    method: overrides?.method ?? 'POST',
    originalUrl: overrides?.originalUrl ?? '/api/v1/test',
    headers: overrides?.requestId
      ? { 'x-request-id': overrides.requestId }
      : {},
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ status: statusMock }),
    }),
  } as unknown as ArgumentsHost;

  return { host, statusMock, jsonMock };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('preserves status and payload for Nest HttpException without 5xx error logging', () => {
    const { host, statusMock, jsonMock } = createMockHost({ requestId: 'req-400' });

    filter.catch(new BadRequestException('Invalid payload'), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid payload',
        requestId: 'req-400',
      }),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('maps Prisma P2002 unique constraint violations to 409 Conflict', () => {
    const { host, statusMock, jsonMock } = createMockHost();
    const prismaError = Object.assign(new Error('Unique constraint failed'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
    });

    filter.catch(prismaError, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
      }),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('maps Prisma P2025 not found and P2003 foreign key errors cleanly', () => {
    const notFound = createMockHost();
    filter.catch(
      Object.assign(new Error('Record not found'), {
        name: 'PrismaClientKnownRequestError',
        code: 'P2025',
      }),
      notFound.host,
    );
    expect(notFound.statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);

    const fk = createMockHost();
    filter.catch(
      Object.assign(new Error('Foreign key failed'), {
        name: 'PrismaClientKnownRequestError',
        code: 'P2003',
      }),
      fk.host,
    );
    expect(fk.statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('logs unexpected 500 errors with stack trace and hides internals from client', () => {
    const { host, statusMock, jsonMock } = createMockHost({
      method: 'GET',
      originalUrl: '/api/v1/crash',
      requestId: 'req-500',
    });

    filter.catch(new Error('Sensitive database password leak'), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        path: '/api/v1/crash',
        requestId: 'req-500',
      }),
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('req-500');
  });
});
