import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';

export class ConsularVerifyDto {
  @ApiProperty({
    example: 'b1234567-89ab-4cde-8123-456789abcdef',
  })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({
    example: '482910',
  })
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'OTP code must be a 6-digit number.',
  })
  code!: string;
}
