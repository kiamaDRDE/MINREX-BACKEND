import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  Transform,
} from 'class-transformer';

import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({
    description:
      'System role code to assign to the user.',
    example:
      'CONSULAR_AGENT',
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase()
      : value,
  )
  @IsString()
  @MaxLength(80)
  roleCode!: string;

  @ApiPropertyOptional({
    description:
      'Diplomatic post UUID. Required for POST scoped roles.',
    nullable:
      true,
  })
  @IsOptional()
  @IsUUID()
  postId?: string | null;

  @ApiPropertyOptional({
    description:
      'Service UUID. Required for SERVICE scoped roles.',
    nullable:
      true,
  })
  @IsOptional()
  @IsUUID()
  serviceId?: string | null;

  @ApiPropertyOptional({
    description:
      'Optional expiration date for the role assignment.',
    example:
      '2027-12-31T23:59:59.000Z',
    nullable:
      true,
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;
}