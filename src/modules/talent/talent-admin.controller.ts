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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../identity/auth/guards/access-token.guard.js';
import type { AuthenticatedRequest } from '../identity/auth/interfaces/authenticated-request.interface.js';
import { PERMISSIONS } from '../identity/authorization/constants/permissions.constants.js';
import { RequirePermissions } from '../identity/authorization/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from '../identity/authorization/guards/permissions.guard.js';

import { ListTalentApplicationsQueryDto } from './dto/list-talent-applications-query.dto.js';
import {
  ApproveTalentApplicationDto,
  RejectTalentApplicationDto,
} from './dto/review-talent-application.dto.js';
import { TalentService } from './talent.service.js';

@ApiTags('Talent - Administration')
@ApiBearerAuth('access-token')
@RequirePermissions(PERMISSIONS.TALENT.MENTORSHIP_MANAGE)
@UseGuards(AccessTokenGuard, PermissionsGuard)
@Controller('talents/admin')
export class TalentAdminController {
  constructor(private readonly talentService: TalentService) {}

  @Get('applications')
  @ApiOperation({
    summary: 'List diaspora expertise/mentor applications for admin validation',
  })
  listApplications(@Query() query: ListTalentApplicationsQueryDto) {
    return this.talentService.listAdminApplications(query);
  }

  @Post('applications/:recordId/approve')
  @ApiOperation({
    summary:
      'Approve an expertise application and automatically grant the MENTOR_EXPERT role',
  })
  approveApplication(
    @Req() request: AuthenticatedRequest,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body() dto: ApproveTalentApplicationDto,
  ) {
    return this.talentService.approveApplication(
      request.auth.userId,
      recordId,
      dto,
    );
  }

  @Post('applications/:recordId/reject')
  @ApiOperation({
    summary: 'Reject a pending expertise application with a reason',
  })
  rejectApplication(
    @Req() request: AuthenticatedRequest,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body() dto: RejectTalentApplicationDto,
  ) {
    return this.talentService.rejectApplication(
      request.auth.userId,
      recordId,
      dto,
    );
  }
}
