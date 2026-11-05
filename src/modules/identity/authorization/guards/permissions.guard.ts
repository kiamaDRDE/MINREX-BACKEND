import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface.js';

import { AuthorizationService } from '../authorization.service.js';
import { AUTHORIZATION_SCOPE_KEY } from '../decorators/authorization-scope.decorator.js';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';
import type {
  AuthorizationContext,
  AuthorizationScopeMetadata,
} from '../interfaces/authorization-context.interface.js';
import { REQUIRED_ANY_PERMISSIONS_KEY,} from '../decorators/require-any-permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const targets = [
      context.getHandler(),
      context.getClass(),
    ];
    
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(
        REQUIRED_PERMISSIONS_KEY,
        targets,
      ) ?? [];
    
    const requiredAnyPermissions =
      this.reflector.getAllAndOverride<string[]>(
        REQUIRED_ANY_PERMISSIONS_KEY,
        targets,
      ) ?? [];
    
    if (
      requiredPermissions.length === 0 &&
      requiredAnyPermissions.length === 0
    ) {
      return true;
    }

    /*
     * AccessTokenGuard must run before PermissionsGuard.
     *
     * AccessTokenGuard injects:
     *
     * request.auth.userId
     * request.auth.sessionId
     */
    const request =
      context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();

    if (!request.auth?.userId) {
      throw new ForbiddenException(
        'Authentication context is missing.',
      );
    }

    /*
     * Retrieve optional authorization scope
     * metadata from the route.
     *
     * Example:
     *
     * @AuthorizationScope({
     *   postParam: 'postId',
     *   serviceParam: 'serviceId',
     * })
     */
    const scopeMetadata =
      this.reflector
        .getAllAndOverride<AuthorizationScopeMetadata>(
          AUTHORIZATION_SCOPE_KEY,
          [
            context.getHandler(),
            context.getClass(),
          ],
        );

    /*
     * Build the authorization context that will
     * be sent to AuthorizationService.
     */
    const authorizationContext:
      AuthorizationContext = {};

    /*
     * Diplomatic post context.
     */
    if (scopeMetadata?.postParam) {
      const postId =
        this.normalizeRouteParam(
          request.params?.[
            scopeMetadata.postParam
          ],
        );

      if (postId) {
        authorizationContext.postId =
          postId;
      }
    }

    if (scopeMetadata?.allowAssignedPosts) {
  authorizationContext.allowAnyPost = true;
    }
    
    if (
      scopeMetadata?.resource &&
      scopeMetadata.resourceIdParam
    ) {
      const resourceId = this.normalizeRouteParam(
        request.params?.[scopeMetadata.resourceIdParam],
      );
    
      if (resourceId) {
        const resourceContext =
          await this.authorizationService.resolveResourceContext(
            scopeMetadata.resource,
            resourceId,
          );
    
        Object.assign(
          authorizationContext,
          resourceContext,
        );
      }
    }

    /*
     * Service context.
     */
    if (scopeMetadata?.serviceParam) {
      const serviceId =
        this.normalizeRouteParam(
          request.params?.[
            scopeMetadata.serviceParam
          ],
        );

      if (serviceId) {
        authorizationContext.serviceId =
          serviceId;
      }
    }

    /*
     * Check whether the authenticated user owns
     * every permission required by the route,
     * taking the current scope into account.
     */
    const [allPermissionsGranted, anyPermissionGranted] =
      await Promise.all([
        requiredPermissions.length > 0
          ? this.authorizationService.hasAllPermissions(
              request.auth.userId,
              requiredPermissions,
              authorizationContext,
            )
          : Promise.resolve(true),
    
        requiredAnyPermissions.length > 0
          ? this.authorizationService.hasAnyPermission(
              request.auth.userId,
              requiredAnyPermissions,
              authorizationContext,
            )
          : Promise.resolve(true),
      ]);
    
    if (
      !allPermissionsGranted ||
      !anyPermissionGranted
    ) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }
    
    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | PRIVATE HELPERS
  |--------------------------------------------------------------------------
  */

  /**
   * Express route parameters can be typed as:
   *
   * string | string[] | undefined
   *
   * MINREX authorization scope expects a single identifier,
   * therefore this helper safely normalizes the value.
   */
  private normalizeRouteParam(
    value:
      | string
      | string[]
      | undefined,
  ): string | undefined {
    if (!value) {
      return undefined;
    }

    if (Array.isArray(value)) {
      const firstValue = value[0];

      return firstValue || undefined;
    }

    return value;
  }
}
