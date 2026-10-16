import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../identity/auth/auth.module.js';

import {
  TalentController,
} from './talent.controller.js';

import {
  TalentService,
} from './talent.service.js';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    TalentController,
  ],

  providers: [
    TalentService,
  ],

  exports: [
    TalentService,
  ],
})
export class TalentModule {}