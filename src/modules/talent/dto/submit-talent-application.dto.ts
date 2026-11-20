import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SubmitTalentApplicationDto {
  @ApiProperty({
    example: 'Architecte Cloud & IA',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  jobTitle!: string;

  @ApiPropertyOptional({
    example: 'Ingénieur Logiciel Senior',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  profession?: string;

  @ApiPropertyOptional({
    example: "Technologies de l'Information & IA",
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  sector?: string;

  @ApiPropertyOptional({
    example: 'TechCorp Europe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  employer?: string;

  @ApiPropertyOptional({
    example: 8,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  yearsExperience?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ["Technologies de l'Information & IA"],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  expertiseDomains?: string[];

  @ApiProperty({
    type: [String],
    example: ['Kubernetes', 'Architecture Cloud', 'NestJS'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  skills!: string[];

  @ApiPropertyOptional({
    example: 'Diplômes: Master Génie Logiciel (Polytechnique, 2019)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  qualifications?: string;

  @ApiPropertyOptional({
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  optInTalentDirectory?: boolean;
}
