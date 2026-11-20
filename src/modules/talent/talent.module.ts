import { Module } from '@nestjs/common';

import { AuthModule } from '../identity/auth/auth.module.js';
import { AuthorizationModule } from '../identity/authorization/authorization.module.js';
import { NotificationModule } from '../notifications/notification.module.js';

import { TalentAdminController } from './talent-admin.controller.js';
import { TalentController } from './talent.controller.js';
import { TalentService } from './talent.service.js';

@Module({
  imports: [AuthModule, AuthorizationModule, NotificationModule],
  controllers: [TalentAdminController, TalentController],
  providers: [TalentService],
  exports: [TalentService],
})
export class TalentModule {}
