import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsEnum,
  IsOptional,
} from 'class-validator';

import {
  MentorshipRequestStatus,
} from '../../../generated/prisma/enums.js';

export class ListMentorshipRequestsQueryDto {
  @ApiPropertyOptional({
    enum:
      MentorshipRequestStatus,
  })
  @IsOptional()
  @IsEnum(
    MentorshipRequestStatus,
  )
  status?: MentorshipRequestStatus;
}