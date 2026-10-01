import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example:
      '4f947bc4a7a5c9356ebc7a8e8c152032cced74566916dc25c90ea0b1977d267c',
  })
  @IsString()
  @Length(64, 64)
  token!: string;
}
