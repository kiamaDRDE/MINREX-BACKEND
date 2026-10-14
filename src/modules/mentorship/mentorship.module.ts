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

import {
  MentorshipAdminController,
} from './mentorship-admin.controller.js';

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    MentorshipController,
    MentorshipAdminController,
  ],

  providers: [
    MentorshipService,
  ],

  exports: [
    MentorshipService,
  ],
})
export class MentorshipModule {}