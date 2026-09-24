import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';

import type { ApiResponse } from '../interfaces/api-response.interface.js';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const response =
      context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        const requestId =
          response.getHeader('x-request-id');

        return {
          success: true,
          statusCode: response.statusCode,
          data,
          requestId:
            typeof requestId === 'string'
              ? requestId
              : undefined,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
