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
  NotificationsModule,
} from '../notifications/notifications.module.js';

import {
  MentorshipController,
} from './mentorship.controller.js';

import {
  MentorshipService,
} from './mentorship.service.js';

import {
  MentorshipAdminController,
} from './mentorship-admin.controller.js';

import {
  MentorshipMentorController,
} from './mentorship-mentor.controller.js';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    NotificationsModule,
  ],

  controllers: [
    MentorshipController,
    MentorshipMentorController,
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