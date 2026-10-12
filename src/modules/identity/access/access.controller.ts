import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  AccessTokenGuard,
} from '../auth/guards/access-token.guard.js';

import type {
  AuthenticatedRequest,
} from '../auth/interfaces/authenticated-request.interface.js';

import {
  PERMISSIONS,
} from '../authorization/constants/permissions.constants.js';

import {
  RequirePermissions,
} from '../authorization/decorators/require-permissions.decorator.js';

import {
  PermissionsGuard,
} from '../authorization/guards/permissions.guard.js';

import {
  AccessService,
} from './access.service.js';

import {
  AssignRoleDto,
} from './dto/assign-role.dto.js';

@ApiTags(
  'Access Control',
)
@ApiBearerAuth(
  'access-token',
)
@Controller(
  'access',
)
@UseGuards(
  AccessTokenGuard,
  PermissionsGuard,
)
export class AccessController {
  constructor(
    private readonly accessService:
      AccessService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | ROLES
  |--------------------------------------------------------------------------
  */

  @Get(
    'roles',
  )
  @RequirePermissions(
    PERMISSIONS.ACCESS.ROLES_READ,
  )
  @ApiOperation({
    summary:
      'List available roles',
  })
  @ApiOkResponse({
    description:
      'Roles returned successfully.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication is required.',
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated user cannot read roles.',
  })
  findRoles() {
    return this.accessService.findRoles();
  }

  /*
  |--------------------------------------------------------------------------
  | PERMISSIONS
  |--------------------------------------------------------------------------
  */

  @Get(
    'permissions',
  )
  @RequirePermissions(
    PERMISSIONS.ACCESS.PERMISSIONS_READ,
  )
  @ApiOperation({
    summary:
      'List available permissions',
  })
  @ApiOkResponse({
    description:
      'Permissions returned successfully.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication is required.',
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated user cannot read permissions.',
  })
  findPermissions() {
    return this.accessService.findPermissions();
  }

  /*
  |--------------------------------------------------------------------------
  | USER ASSIGNMENTS
  |--------------------------------------------------------------------------
  */

  @Get(
    'users/:userId/assignments',
  )
  @RequirePermissions(
    PERMISSIONS.ACCESS.ROLES_READ,
  )
  @ApiOperation({
    summary:
      'List role assignments for a user',
  })
  @ApiOkResponse({
    description:
      'User role assignments returned successfully.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication is required.',
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated user cannot read role assignments.',
  })
  @ApiNotFoundResponse({
    description:
      'User not found.',
  })
  findUserAssignments(
    @Param(
      'userId',
      ParseUUIDPipe,
    )
    userId: string,
  ) {
    return this.accessService.findUserAssignments(
      userId,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | ASSIGN ROLE
  |--------------------------------------------------------------------------
  */

  @Post(
    'users/:userId/assignments',
  )
  @RequirePermissions(
    PERMISSIONS.ACCESS.ROLES_ASSIGN,
  )
  @ApiOperation({
    summary:
      'Assign a role to a user',
  })
  @ApiCreatedResponse({
    description:
      'Role assigned successfully.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid role scope, post, service or expiration date.',
  })
  @ApiConflictResponse({
    description:
      'The user already has this active role assignment.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication is required.',
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated user cannot assign roles.',
  })
  @ApiNotFoundResponse({
    description:
      'User, role, diplomatic post or service not found.',
  })
  assignRole(
    @Param(
      'userId',
      ParseUUIDPipe,
    )
    userId: string,

    @Body()
    dto:
      AssignRoleDto,
  ) {
    return this.accessService.assignRole(
      userId,
      dto,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | DEACTIVATE ROLE ASSIGNMENT
  |--------------------------------------------------------------------------
  */

  @Patch(
    'assignments/:assignmentId/deactivate',
  )
  @RequirePermissions(
    PERMISSIONS.ACCESS.ROLES_ASSIGN,
  )
  @ApiOperation({
    summary:
      'Deactivate a user role assignment',
  })
  @ApiOkResponse({
    description:
      'Role assignment deactivated successfully.',
  })
  @ApiBadRequestResponse({
    description:
      'The requested assignment cannot be deactivated.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication is required.',
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated user cannot deactivate role assignments.',
  })
  @ApiNotFoundResponse({
    description:
      'Role assignment not found.',
  })
  deactivateAssignment(
    @Param(
      'assignmentId',
      ParseUUIDPipe,
    )
    assignmentId: string,

    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.accessService.deactivateAssignment(
      assignmentId,
      request.auth.userId,
    );
  }
}