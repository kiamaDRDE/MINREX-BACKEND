import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  IsUUID,
} from 'class-validator';

export class MatchMentorshipRequestDto {
  @ApiProperty({
    description:
      'User ID of the mentor to assign.',
  })
  @IsUUID()
  mentorId!: string;
}