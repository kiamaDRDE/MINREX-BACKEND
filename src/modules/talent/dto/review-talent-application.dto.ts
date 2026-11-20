import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ApproveTalentApplicationDto {
  @ApiPropertyOptional({
    example: 'Profil d’expertise vérifié et conforme aux critères MTC.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class RejectTalentApplicationDto {
  @ApiProperty({
    example: 'Justificatifs de diplômes ou d’expérience insuffisants.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}
