import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ConsularChallengeDto {
  @ApiProperty({
    example: 'CMR-FRPAR-2026-4F9A2C',
    description:
      'Consular identifier (CMR-...), verified census reference, or verified identity document number',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(100)
  consularId!: string;

  @ApiProperty({
    example: '1990-05-14',
    description: 'Citizen date of birth (ISO YYYY-MM-DD) matching verified consular records',
  })
  @IsDateString()
  birthDate!: string;

  @ApiPropertyOptional({
    enum: ['EMAIL', 'SMS'],
    default: 'EMAIL',
    description: 'Second-factor OTP delivery channel',
  })
  @IsOptional()
  @IsIn(['EMAIL', 'SMS'])
  deliveryChannel?: 'EMAIL' | 'SMS';
}
