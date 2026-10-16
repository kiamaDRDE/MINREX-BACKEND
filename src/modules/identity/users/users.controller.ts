import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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
  ListUsersQueryDto,
} from './dto/list-users-query.dto.js';

import {
  UpdateUserDto,
} from './dto/update-user.dto.js';

import {
  UpdateUserStatusDto,
} from './dto/update-user-status.dto.js';

import {
  UsersService,
} from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth(
  'access-token',
)
@Controller(
  'users',
)
@UseGuards(
  AccessTokenGuard,
  PermissionsGuard,
)
export class UsersController {
  constructor(
    private readonly usersService:
      UsersService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | LIST USERS
  |--------------------------------------------------------------------------
  */

  @Get()
  @RequirePermissions(
    PERMISSIONS.IDENTITY.USERS_READ,
  )
  @ApiOperation({
    summary:
      'List MINREX users',
  })
  @ApiOkResponse({
    description:
      'Paginated users returned successfully.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication is required.',
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated user does not have permission to read users.',
  })
  findAll(
    @Query()
    query:
      ListUsersQueryDto,
  ) {
    return this.usersService.findAll(
      query,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | GET ONE USER
  |--------------------------------------------------------------------------
  */

  @Get(
    ':userId',
  )
  @RequirePermissions(
    PERMISSIONS.IDENTITY.USERS_READ,
  )
  @ApiOperation({
    summary:
      'Get a MINREX user by ID',
  })
  @ApiOkResponse({
    description:
      'User returned successfully.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication is required.',
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated user does not have permission to read users.',
  })
  @ApiNotFoundResponse({
    description:
      'User not found.',
  })
  findOne(
    @Param(
      'userId',
      ParseUUIDPipe,
    )
    userId: string,
  ) {
    return this.usersService.findOne(
      userId,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE USER STATUS
  |--------------------------------------------------------------------------
  */

  @Patch(
    ':userId/status',
  )
  @RequirePermissions(
    PERMISSIONS.IDENTITY.USERS_MANAGE,
  )
  @ApiOperation({
    summary:
      'Change the administrative status of a MINREX user',
  })
  @ApiOkResponse({
    description:
      'User status updated successfully.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid status transition.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication is required.',
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated user cannot manage users.',
  })
  @ApiNotFoundResponse({
    description:
      'User not found.',
  })
  updateStatus(
    @Param(
      'userId',
      ParseUUIDPipe,
    )
    userId: string,

    @Body()
    dto:
      UpdateUserStatusDto,

    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.usersService.updateStatus(
      userId,
      request.auth.userId,
      dto,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE USER
  |--------------------------------------------------------------------------
  */

  @Patch(
    ':userId',
  )
  @RequirePermissions(
    PERMISSIONS.IDENTITY.USERS_MANAGE,
  )
  @ApiOperation({
    summary:
      'Update a MINREX user',
  })
  @ApiOkResponse({
    description:
      'User updated successfully.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid user information.',
  })
  @ApiConflictResponse({
    description:
      'Username already exists.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication is required.',
  })
  @ApiForbiddenResponse({
    description:
      'The authenticated user cannot manage users.',
  })
  @ApiNotFoundResponse({
    description:
      'User not found.',
  })
  update(
    @Param(
      'userId',
      ParseUUIDPipe,
    )
    userId: string,

    @Body()
    dto:
      UpdateUserDto,
  ) {
    return this.usersService.update(
      userId,
      dto,
    );
  }
}