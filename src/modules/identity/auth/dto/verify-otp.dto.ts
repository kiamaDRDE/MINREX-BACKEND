import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    enum: ['SMS', 'EMAIL'],
    example: 'SMS',
  })
  @IsIn(['SMS', 'EMAIL'])
  channel!: 'SMS' | 'EMAIL';

  @ApiProperty({
    example: '+237699123456',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  identifier!: string;

  @ApiProperty({
    example: '482910',
    description: '6-digit numeric one-time passcode',
  })
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'OTP code must be a 6-digit number.',
  })
  code!: string;
}
