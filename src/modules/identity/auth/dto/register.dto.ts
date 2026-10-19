import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: '+237699123456',
    description:
      'User phone number in international E.164 format.',
  })
  @IsString()
  @Matches(
    /^\+[1-9]\d{7,14}$/,
    {
      message:
        'phone must be a valid international phone number.',
    },
  )
  phone!: string;

  @ApiProperty({
    example: 'Germany',
    description:
      'Country of residence selected by the user.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  residenceCountry!: string;

  @ApiProperty({
    example: 'ermon@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    example: 'ermongabriel',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'Username can only contain letters, numbers, dots, underscores and hyphens',
  })
  username!: string;

  @ApiProperty({
    example: 'StrongPassword123',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/[0-9]/, {
    message: 'Password must contain at least one number',
  })
  password!: string;

  @ApiProperty({
    example: 'Ermon',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({
    example: 'Gabriel',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;
}
