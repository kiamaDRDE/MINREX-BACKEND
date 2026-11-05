import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { NotificationType } from '../../../generated/prisma/enums.js';

export class NotificationPreferenceItemDto {
  @ApiProperty({
    description: 'Notification event type',
    enum: NotificationType,
  })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiProperty({
    description: 'Enable email channel',
    default: true,
  })
  @IsBoolean()
  emailEnabled!: boolean;

  @ApiProperty({
    description: 'Enable in-app channel',
    default: true,
  })
  @IsBoolean()
  inAppEnabled!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    description: 'List of preferences per notification type',
    type: [NotificationPreferenceItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceItemDto)
  preferences!: NotificationPreferenceItemDto[];
}
