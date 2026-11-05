import { PartialType } from '@nestjs/swagger';
import { CreateAssociationDto } from './create-association.dto.js';

export class UpdateAssociationDto extends PartialType(CreateAssociationDto) {}
