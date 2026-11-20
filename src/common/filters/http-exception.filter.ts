import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { Prisma } from '../../generated/prisma/client.js';

interface MappedError {
  statusCode: number;
  error: string;
  message: string | string[];
}

function mapPrismaError(exception: unknown): MappedError | null {
  if (
    exception instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof exception === 'object' &&
      exception !== null &&
      (exception as { name?: unknown }).name === 'PrismaClientKnownRequestError' &&
      typeof (exception as { code?: unknown }).code === 'string')
  ) {
    const code = (exception as { code: string }).code;

    if (code === 'P2002') {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'A record with this unique value already exists.',
      };
    }

    if (code === 'P2025') {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Requested resource was not found.',
      };
    }

    if (code === 'P2003') {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Invalid reference to a related resource.',
      };
    }

    if (code === 'P2023') {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Invalid identifier format.',
      };
    }
  }

  if (
    exception instanceof Prisma.PrismaClientValidationError ||
    (typeof exception === 'object' &&
      exception !== null &&
      (exception as { name?: unknown }).name === 'PrismaClientValidationError')
  ) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      message: 'Invalid request parameters.',
    };
  }

  return null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();

    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObject = exceptionResponse as {
          message?: string | string[];
          error?: string;
        };

        message =
          responseObject.message ?? exception.message;

        error =
          responseObject.error ?? exception.name;
      }
    } else {
      const mappedPrisma = mapPrismaError(exception);
      if (mappedPrisma) {
        statusCode = mappedPrisma.statusCode;
        error = mappedPrisma.error;
        message = mappedPrisma.message;
      }
    }

    const requestIdHeader = request.headers['x-request-id'];
    const requestId =
      typeof requestIdHeader === 'string' ? requestIdHeader : undefined;

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const summary = `[${request.method} ${request.originalUrl}] Unhandled ${statusCode}${
        requestId ? ` (requestId=${requestId})` : ''
      }`;
      if (exception instanceof Error) {
        this.logger.error(`${summary}: ${exception.message}`, exception.stack);
      } else {
        this.logger.error(`${summary}: ${String(exception)}`);
      }
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      error,
      message,
      path: request.originalUrl,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}

