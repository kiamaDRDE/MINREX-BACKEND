import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AccessTokenGuard } from '../identity/auth/guards/access-token.guard.js';
import type { AuthenticatedRequest } from '../identity/auth/interfaces/authenticated-request.interface.js';
import { PERMISSIONS } from '../identity/authorization/constants/permissions.constants.js';
import { RequirePermissions } from '../identity/authorization/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from '../identity/authorization/guards/permissions.guard.js';

import { ListTalentsQueryDto } from './dto/list-talents-query.dto.js';
import { SubmitTalentApplicationDto } from './dto/submit-talent-application.dto.js';
import { TalentService } from './talent.service.js';

@ApiTags('Talent')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('talents')
export class TalentController {
  constructor(private readonly talentService: TalentService) {}

  @Get()
  @ApiOperation({
    summary: 'List approved diaspora talents who opted into the talent directory',
  })
  findAll(@Query() query: ListTalentsQueryDto) {
    return this.talentService.findAll(query);
  }

  @Get('me/application')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.TALENT.PROFILES_MANAGE_SELF)
  @ApiOperation({
    summary: 'Get the authenticated diaspora member expertise application status',
  })
  getMyApplication(@Req() request: AuthenticatedRequest) {
    return this.talentService.getMyApplication(request.auth.userId);
  }

  @Post('me/application')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.TALENT.PROFILES_MANAGE_SELF)
  @ApiOperation({
    summary: 'Submit or update an expertise/mentor accreditation application',
  })
  submitMyApplication(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SubmitTalentApplicationDto,
  ) {
    return this.talentService.submitMyApplication(request.auth.userId, dto);
  }

  @Get(':talentId')
  @ApiOperation({
    summary: 'Get one approved talent profile',
  })
  findOne(@Param('talentId', ParseUUIDPipe) talentId: string) {
    return this.talentService.findOne(talentId);
  }
}
