export type NotificationTypeCode =
  | 'CENSUS_STATUS'
  | 'ASSISTANCE_STATUS'
  | 'ASSOCIATION_STATUS'
  | 'PUBLICATION_ALERT'
  | 'MENTORSHIP_INVITE'
  | 'SYSTEM_SECURITY';

export type NotificationPriorityCode =
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT';

export interface NotificationPayload {
  type: NotificationTypeCode;

  title: string;

  message: string;

  priority?: NotificationPriorityCode;

  actionUrl?: string | null;
}

export type NotificationRoleCode =
  | 'PLATFORM_ADMIN'
  | 'MINREX_CENTRAL_AGENT'
  | 'POST_MANAGER'
  | 'CONSULAR_AGENT'
  | 'DIASPORA_MEMBER'
  | 'MENTOR_EXPERT';