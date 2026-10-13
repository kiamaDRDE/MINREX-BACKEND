import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  AccessTokenGuard,
} from '../identity/auth/guards/access-token.guard.js';

import {
  PERMISSIONS,
} from '../identity/authorization/constants/permissions.constants.js';

import {
  RequirePermissions,
} from '../identity/authorization/decorators/require-permissions.decorator.js';

import {
  PermissionsGuard,
} from '../identity/authorization/guards/permissions.guard.js';

import {
  CreateCountryDto,
} from './dto/create-country.dto.js';

import {
  CreateDiplomaticPostDto,
} from './dto/create-diplomatic-post.dto.js';

import {
  CreatePostTypeDto,
} from './dto/create-post-type.dto.js';

import {
  UpdateDiplomaticPostDto,
} from './dto/update-diplomatic-post.dto.js';

import {
  NetworkService,
} from './network.service.js';

@ApiTags(
  'Diplomatic Network',
)
@ApiBearerAuth(
  'access-token',
)
@Controller(
  'network',
)
@UseGuards(
  AccessTokenGuard,
  PermissionsGuard,
)
export class NetworkController {
  constructor(
    private readonly networkService:
      NetworkService,
  ) {}

  @Get(
    'countries',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.POSTS_READ,
  )
  @ApiOperation({
    summary:
      'List active countries',
  })
  @ApiOkResponse()
  findCountries() {
    return this.networkService.findCountries();
  }

  @Post(
    'countries',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.MANAGE,
  )
  @ApiOperation({
    summary:
      'Create a country',
  })
  @ApiCreatedResponse()
  createCountry(
    @Body()
    dto:
      CreateCountryDto,
  ) {
    return this.networkService.createCountry(
      dto,
    );
  }

  @Get(
    'post-types',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.POSTS_READ,
  )
  @ApiOperation({
    summary:
      'List diplomatic post types',
  })
  findPostTypes() {
    return this.networkService.findPostTypes();
  }

  @Post(
    'post-types',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.MANAGE,
  )
  @ApiOperation({
    summary:
      'Create a diplomatic post type',
  })
  @ApiCreatedResponse()
  createPostType(
    @Body()
    dto:
      CreatePostTypeDto,
  ) {
    return this.networkService.createPostType(
      dto,
    );
  }

  @Get(
    'posts',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.POSTS_READ,
  )
  @ApiOperation({
    summary:
      'List diplomatic posts',
  })
  findPosts() {
    return this.networkService.findPosts();
  }

  @Get(
    'posts/:postId',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.POSTS_READ,
  )
  @ApiOperation({
    summary:
      'Get a diplomatic post',
  })
  findPost(
    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId: string,
  ) {
    return this.networkService.findPost(
      postId,
    );
  }

  @Post(
    'posts',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.MANAGE,
  )
  @ApiOperation({
    summary:
      'Create a diplomatic post',
  })
  @ApiCreatedResponse()
  createPost(
    @Body()
    dto:
      CreateDiplomaticPostDto,
  ) {
    return this.networkService.createPost(
      dto,
    );
  }

  @Patch(
    'posts/:postId',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.MANAGE,
  )
  @ApiOperation({
    summary:
      'Update a diplomatic post',
  })
  updatePost(
    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId: string,

    @Body()
    dto:
      UpdateDiplomaticPostDto,
  ) {
    return this.networkService.updatePost(
      postId,
      dto,
    );
  }
}