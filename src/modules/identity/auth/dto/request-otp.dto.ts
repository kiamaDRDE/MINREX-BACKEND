import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({
    enum: ['SMS', 'EMAIL'],
    example: 'SMS',
    description: 'OTP delivery channel',
  })
  @IsIn(['SMS', 'EMAIL'])
  channel!: 'SMS' | 'EMAIL';

  @ApiProperty({
    example: '+237699123456',
    description: 'International E.164 phone number or verified email address',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  identifier!: string;
}
