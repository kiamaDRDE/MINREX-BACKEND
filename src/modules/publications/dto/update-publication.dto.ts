import { PartialType } from '@nestjs/swagger';
import { CreatePublicationDto } from './create-publication.dto.js';

export class UpdatePublicationDto extends PartialType(CreatePublicationDto) {}

