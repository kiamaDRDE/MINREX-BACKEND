import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../identity/auth/auth.module.js';

import {
  MentorshipController,
} from './mentorship.controller.js';

import {
  MentorshipService,
} from './mentorship.service.js';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    MentorshipController,
  ],

  providers: [
    MentorshipService,
  ],

  exports: [
    MentorshipService,
  ],
})
export class MentorshipModule {}