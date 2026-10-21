import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DevGrantAdminDto {
  @ApiProperty({
    description:
      'Email address or username of the user account to grant PLATFORM_ADMIN role.',
    example: 'test@minrex.cm',
  })
  @IsNotEmpty({ message: 'Email or username is required.' })
  @IsString()
  identifier!: string;
}
