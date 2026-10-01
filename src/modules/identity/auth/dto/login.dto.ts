import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'ermongabriel',
    description: 'Email address or username',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  identifier!: string;

  @ApiProperty({
    example: 'StrongPassword123',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
