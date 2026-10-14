import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  AccessTokenGuard,
} from '../identity/auth/guards/access-token.guard.js';

import {
  ListTalentsQueryDto,
} from './dto/list-talents-query.dto.js';

import {
  TalentService,
} from './talent.service.js';

@ApiTags('Talent')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('talents')
export class TalentController {
  constructor(
    private readonly talentService:
      TalentService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List verified diaspora talents who opted into the talent directory',
  })
  findAll(
    @Query()
    query: ListTalentsQueryDto,
  ) {
    return this.talentService.findAll(
      query,
    );
  }

  @Get(':talentId')
  @ApiOperation({
    summary:
      'Get one verified talent profile',
  })
  findOne(
    @Param(
      'talentId',
      ParseUUIDPipe,
    )
    talentId: string,
  ) {
    return this.talentService.findOne(
      talentId,
    );
  }
}