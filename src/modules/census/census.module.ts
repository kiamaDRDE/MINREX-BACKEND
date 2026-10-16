import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../identity/auth/auth.module.js';

import {
  AuthorizationModule,
} from '../identity/authorization/authorization.module.js';

import {
  CensusAgentController,
} from './agent/census-agent.controller.js';

import {
  CensusAgentService,
} from './agent/census-agent.service.js';

import {
  CensusController,
} from './census.controller.js';

import {
  CensusService,
} from './census.service.js';

import {
  CensusDocumentsController,
} from './documents/census-documents.controller.js';

import {
  CensusDocumentsService,
} from './documents/census-documents.service.js';

import {
  CensusDocumentStorageService,
} from './documents/census-document-storage.service.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
  ],

  controllers: [
    CensusController,
    CensusAgentController,
    CensusDocumentsController,
  ],

  providers: [
    CensusService,
    CensusAgentService,
    CensusDocumentsService,
    CensusDocumentStorageService,
  ],

  exports: [
    CensusService,
    CensusAgentService,
    CensusDocumentsService,
  ],
})
export class CensusModule {}