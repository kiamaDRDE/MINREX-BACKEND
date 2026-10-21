import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DevActivateDto {
  @ApiProperty({
    description: 'Email address or username of the user account to activate.',
    example: 'test@minrex.cm',
  })
  @IsNotEmpty({ message: 'Email or username is required.' })
  @IsString()
  identifier!: string;
}
