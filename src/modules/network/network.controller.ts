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
  CreatePostCoverageDto,
} from './dto/create-post-coverage.dto.js';

import {
  CreatePostTypeDto,
} from './dto/create-post-type.dto.js';

import {
  CreateServiceDto,
} from './dto/create-service.dto.js';

import {
  UpdateDiplomaticPostDto,
} from './dto/update-diplomatic-post.dto.js';

import {
  UpdatePostCoverageDto,
} from './dto/update-post-coverage.dto.js';

import {
  UpdateServiceDto,
} from './dto/update-service.dto.js';

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

  /*
  |--------------------------------------------------------------------------
  | COUNTRIES
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | POST TYPES
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | DIPLOMATIC POSTS
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | SERVICES
  |--------------------------------------------------------------------------
  */

  @Get(
    'posts/:postId/services',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.POSTS_READ,
  )
  @ApiOperation({
    summary:
      'List services of a diplomatic post',
  })
  findServices(
    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId: string,
  ) {
    return this.networkService.findServices(
      postId,
    );
  }

  @Post(
    'posts/:postId/services',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.MANAGE,
  )
  @ApiOperation({
    summary:
      'Create a service in a diplomatic post',
  })
  @ApiCreatedResponse()
  createService(
    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId: string,

    @Body()
    dto:
      CreateServiceDto,
  ) {
    return this.networkService.createService(
      postId,
      dto,
    );
  }

  @Patch(
    'services/:serviceId',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.MANAGE,
  )
  @ApiOperation({
    summary:
      'Update a diplomatic service',
  })
  updateService(
    @Param(
      'serviceId',
      ParseUUIDPipe,
    )
    serviceId: string,

    @Body()
    dto:
      UpdateServiceDto,
  ) {
    return this.networkService.updateService(
      serviceId,
      dto,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | POST COVERAGE
  |--------------------------------------------------------------------------
  */

  @Get(
    'posts/:postId/coverages',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.POSTS_READ,
  )
  @ApiOperation({
    summary:
      'List geographic coverages of a diplomatic post',
  })
  findCoverages(
    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId: string,
  ) {
    return this.networkService.findCoverages(
      postId,
    );
  }

  @Post(
    'posts/:postId/coverages',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.MANAGE,
  )
  @ApiOperation({
    summary:
      'Add geographic coverage to a diplomatic post',
  })
  @ApiCreatedResponse()
  createCoverage(
    @Param(
      'postId',
      ParseUUIDPipe,
    )
    postId: string,

    @Body()
    dto:
      CreatePostCoverageDto,
  ) {
    return this.networkService.createCoverage(
      postId,
      dto,
    );
  }

  @Patch(
    'coverages/:coverageId',
  )
  @RequirePermissions(
    PERMISSIONS.NETWORK.MANAGE,
  )
  @ApiOperation({
    summary:
      'Update or end diplomatic post coverage',
  })
  updateCoverage(
    @Param(
      'coverageId',
      ParseUUIDPipe,
    )
    coverageId: string,

    @Body()
    dto:
      UpdatePostCoverageDto,
  ) {
    return this.networkService.updateCoverage(
      coverageId,
      dto,
    );
  }
}