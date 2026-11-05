import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class UploadAssociationDocumentDto {
  @ApiProperty({
    description: 'Type de document (STATUTS, RECEPISSE, PV_ASSEMBLEE, LISTE_BUREAU, AUTRE)',
    example: 'RECEPISSE',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type!: string;

  @ApiProperty({
    description: 'Intitulé ou titre du document',
    example: 'Récépissé officiel de déclaration en Préfecture',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiProperty({
    description: 'URL sécurisée d’accès au fichier',
    example: 'https://storage.minrex.cm/associations/docs/recepisse.pdf',
  })
  @IsUrl()
  @IsNotEmpty()
  @MaxLength(500)
  fileUrl!: string;

  @ApiProperty({
    description: 'Clé de stockage interne (S3/MinIO key)',
    example: 'associations/assoc-123/recepisse.pdf',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileKey!: string;

  @ApiProperty({
    description: 'Taille du fichier en octets',
    example: 1048576,
  })
  @IsInt()
  @Min(1)
  fileSize!: number;

  @ApiProperty({
    description: 'Type MIME du document (application/pdf, image/jpeg, etc.)',
    example: 'application/pdf',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType!: string;
}
