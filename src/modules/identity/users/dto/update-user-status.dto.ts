import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  IsIn,
} from 'class-validator';

import {
  UserStatus,
} from '../../../../generated/prisma/enums.js';

const MANAGEABLE_USER_STATUSES = [
  UserStatus.ACTIVE,
  UserStatus.SUSPENDED,
  UserStatus.DISABLED,
] as const;

export class UpdateUserStatusDto {
  @ApiProperty({
    description:
      'New administrative account status.',
    enum:
      MANAGEABLE_USER_STATUSES,
    example:
      UserStatus.SUSPENDED,
  })
  @IsIn(
    MANAGEABLE_USER_STATUSES,
  )
  status!: UserStatus;
}