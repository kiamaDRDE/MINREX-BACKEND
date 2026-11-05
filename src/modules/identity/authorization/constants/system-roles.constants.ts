import { RoleScope } from '../../../../generated/prisma/enums.js';

import {
  PERMISSIONS,
  SYSTEM_PERMISSIONS,
} from './permissions.constants.js';

import type {
  PermissionCode,
} from './permissions.constants.js';

/*
|--------------------------------------------------------------------------
| SYSTEM ROLE CODES
|--------------------------------------------------------------------------
|
| These codes are stable identifiers.
|
| Business logic should use the role code, not the display name.
|
*/

export const SYSTEM_ROLE_CODES = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',

  MINREX_CENTRAL_AGENT:
    'MINREX_CENTRAL_AGENT',

  POST_MANAGER: 'POST_MANAGER',

  CONSULAR_AGENT: 'CONSULAR_AGENT',

  DIASPORA_MEMBER: 'DIASPORA_MEMBER',

  MENTOR_EXPERT: 'MENTOR_EXPERT',
} as const;

export type SystemRoleCode =
  (typeof SYSTEM_ROLE_CODES)[keyof typeof SYSTEM_ROLE_CODES];

/*
|--------------------------------------------------------------------------
| SYSTEM ROLE DEFINITION
|--------------------------------------------------------------------------
*/

export interface SystemRoleDefinition {
  code: SystemRoleCode;

  name: string;

  description: string;

  scope: RoleScope;

  isSystem: true;

  permissions:
    readonly PermissionCode[];
}

/*
|--------------------------------------------------------------------------
| ALL MVP PERMISSION CODES
|--------------------------------------------------------------------------
|
| Platform administrators receive every permission defined by the
| official MVP permission catalogue.
|
*/

const ALL_MVP_PERMISSION_CODES =
  SYSTEM_PERMISSIONS.map(
    (permission) => permission.code,
  );

/*
|--------------------------------------------------------------------------
| SYSTEM ROLES
|--------------------------------------------------------------------------
*/

export const SYSTEM_ROLES:
  readonly SystemRoleDefinition[] = [
    /*
    |--------------------------------------------------------------------------
    | PLATFORM ADMINISTRATOR
    |--------------------------------------------------------------------------
    */

    {
      code:
        SYSTEM_ROLE_CODES.PLATFORM_ADMIN,

      name:
        'Platform Administrator',

      description:
        'Technical and functional administrator of the MINREX platform with global access to MVP administration capabilities.',

      scope:
        RoleScope.GLOBAL,

      isSystem:
        true,

      permissions:
        ALL_MVP_PERMISSION_CODES,
    },

    /*
    |--------------------------------------------------------------------------
    | MINREX CENTRAL AGENT
    |--------------------------------------------------------------------------
    */

    {
      code:
        SYSTEM_ROLE_CODES.MINREX_CENTRAL_AGENT,

      name:
        'MINREX Central Agent',

      description:
        'MINREX central-level agent responsible for cross-post consultation and management of authorized MVP workflows.',

      scope:
        RoleScope.GLOBAL,

      isSystem:
        true,

      permissions: [
        /*
         * Identity
         */

        PERMISSIONS.IDENTITY.USERS_READ,

        /*
         * Access visibility
         */

        PERMISSIONS.ACCESS.ROLES_READ,

        PERMISSIONS.ACCESS.PERMISSIONS_READ,

        /*
         * Diplomatic network
         */

        PERMISSIONS.NETWORK.POSTS_READ,

        /*
         * Census
         */

        PERMISSIONS.CENSUS.RECORDS_READ,

        PERMISSIONS.CENSUS.RECORDS_REVIEW,

        PERMISSIONS.CENSUS
          .RECORDS_REQUEST_CORRECTION,

        PERMISSIONS.CENSUS.RECORDS_VERIFY,

        /*
         * Assistance
         */

        PERMISSIONS.ASSISTANCE.CASES_READ,

        PERMISSIONS.ASSISTANCE.CASES_ASSIGN,

        PERMISSIONS.ASSISTANCE.CASES_UPDATE,

        PERMISSIONS.ASSISTANCE.CASES_CLOSE,

        /*
         * Talent
         */

        PERMISSIONS.TALENT.PROFILES_READ,

        PERMISSIONS.TALENT.MENTORSHIP_MANAGE,

        /*
         * Associations
         */
        PERMISSIONS.ASSOCIATIONS.READ,
        PERMISSIONS.ASSOCIATIONS.REVIEW,
        PERMISSIONS.ASSOCIATIONS.REQUEST_CORRECTION,
        PERMISSIONS.ASSOCIATIONS.APPROVE,
        PERMISSIONS.ASSOCIATIONS.REJECT,
        PERMISSIONS.ASSOCIATIONS.SUSPEND,
        PERMISSIONS.ASSOCIATIONS.MANAGE,

        /*
         * Notifications
         */
        PERMISSIONS.NOTIFICATIONS.READ_SELF,
        PERMISSIONS.NOTIFICATIONS.MANAGE_SELF,
        PERMISSIONS.NOTIFICATIONS.BROADCAST,
      ],
    },

    /*
    |--------------------------------------------------------------------------
    | DIPLOMATIC POST MANAGER
    |--------------------------------------------------------------------------
    */

    {
      code:
        SYSTEM_ROLE_CODES.POST_MANAGER,

      name:
        'Diplomatic Post Manager',

      description:
        'Manager responsible for authorized workflows within a specific diplomatic post.',

      scope:
        RoleScope.POST,

      isSystem:
        true,

      permissions: [
        /*
         * Users
         */

        PERMISSIONS.IDENTITY.USERS_READ,

        /*
         * Diplomatic network
         */

        PERMISSIONS.NETWORK.POSTS_READ,

        /*
         * Census
         */

        PERMISSIONS.CENSUS.RECORDS_READ,

        PERMISSIONS.CENSUS.RECORDS_REVIEW,

        PERMISSIONS.CENSUS
          .RECORDS_REQUEST_CORRECTION,

        PERMISSIONS.CENSUS.RECORDS_VERIFY,

        /*
         * Assistance
         */

        PERMISSIONS.ASSISTANCE.CASES_READ,

        PERMISSIONS.ASSISTANCE.CASES_ASSIGN,

        PERMISSIONS.ASSISTANCE.CASES_UPDATE,

        PERMISSIONS.ASSISTANCE.CASES_CLOSE,

        /*
         * Talent
         */

        PERMISSIONS.TALENT.PROFILES_READ,

        /*
         * Associations
         */
        PERMISSIONS.ASSOCIATIONS.READ,
        PERMISSIONS.ASSOCIATIONS.REVIEW,
        PERMISSIONS.ASSOCIATIONS.REQUEST_CORRECTION,
        PERMISSIONS.ASSOCIATIONS.APPROVE,
        PERMISSIONS.ASSOCIATIONS.REJECT,
        PERMISSIONS.ASSOCIATIONS.SUSPEND,

        /*
         * Notifications
         */
        PERMISSIONS.NOTIFICATIONS.READ_SELF,
        PERMISSIONS.NOTIFICATIONS.MANAGE_SELF,

        /*
         * Publications
         */
        PERMISSIONS.PUBLICATIONS.CREATE,
        PERMISSIONS.PUBLICATIONS.READ_SELF,
        PERMISSIONS.PUBLICATIONS.UPDATE_SELF,
        PERMISSIONS.PUBLICATIONS.SUBMIT,
        PERMISSIONS.PUBLICATIONS.READ,
        PERMISSIONS.PUBLICATIONS.REVIEW_LEVEL1,
        PERMISSIONS.PUBLICATIONS.APPROVE_LEVEL2,
        PERMISSIONS.PUBLICATIONS.FEATURE,
        PERMISSIONS.PUBLICATIONS.ARCHIVE,
      ],
    },

    /*
    |--------------------------------------------------------------------------
    | CONSULAR AGENT
    |--------------------------------------------------------------------------
    */

    {
      code:
        SYSTEM_ROLE_CODES.CONSULAR_AGENT,

      name:
        'Consular Agent',

      description:
        'Consular agent authorized to process census and assistance activities within an assigned diplomatic post.',

      scope:
        RoleScope.POST,

      isSystem:
        true,

      permissions: [
        /*
         * Diplomatic network
         */

        PERMISSIONS.NETWORK.POSTS_READ,

        /*
         * Census
         */

        PERMISSIONS.CENSUS.RECORDS_READ,

        PERMISSIONS.CENSUS.RECORDS_REVIEW,

        PERMISSIONS.CENSUS
          .RECORDS_REQUEST_CORRECTION,

        /*
         * Assistance
         */

        PERMISSIONS.ASSISTANCE.CASES_READ,

        PERMISSIONS.ASSISTANCE.CASES_UPDATE,

        PERMISSIONS.ASSISTANCE.CASES_CLOSE,

        /*
         * Associations
         */
        PERMISSIONS.ASSOCIATIONS.READ,
        PERMISSIONS.ASSOCIATIONS.REVIEW,
        PERMISSIONS.ASSOCIATIONS.REQUEST_CORRECTION,

        /*
         * Notifications
         */
        PERMISSIONS.NOTIFICATIONS.READ_SELF,
        PERMISSIONS.NOTIFICATIONS.MANAGE_SELF,

        /*
         * Publications
         */
        PERMISSIONS.PUBLICATIONS.READ,
        PERMISSIONS.PUBLICATIONS.REVIEW_LEVEL1,
      ],
    },

    /*
    |--------------------------------------------------------------------------
    | DIASPORA MEMBER
    |--------------------------------------------------------------------------
    */

    {
      code:
        SYSTEM_ROLE_CODES.DIASPORA_MEMBER,

      name:
        'Diaspora Member',

      description:
        'Standard diaspora user with permissions limited to their own census, assistance and talent activities.',

      scope:
        RoleScope.GLOBAL,

      isSystem:
        true,

      permissions: [
        /*
         * Census
         */

        PERMISSIONS.CENSUS.RECORDS_CREATE,

        PERMISSIONS.CENSUS
          .RECORDS_READ_SELF,

        /*
         * Assistance
         */

        PERMISSIONS.ASSISTANCE.CASES_CREATE,

        PERMISSIONS.ASSISTANCE
          .CASES_READ_SELF,

        /*
         * Talent
         */

        PERMISSIONS.TALENT
          .PROFILES_MANAGE_SELF,

        PERMISSIONS.TALENT
          .MENTORSHIP_REQUEST,

        /*
         * Associations
         */
        PERMISSIONS.ASSOCIATIONS.CREATE,
        PERMISSIONS.ASSOCIATIONS.READ_SELF,
        PERMISSIONS.ASSOCIATIONS.UPDATE_SELF,
        PERMISSIONS.ASSOCIATIONS.SUBMIT,

        /*
         * Publications personnelles
         */
        PERMISSIONS.PUBLICATIONS.CREATE,
        PERMISSIONS.PUBLICATIONS.READ_SELF,
        PERMISSIONS.PUBLICATIONS.UPDATE_SELF,
        PERMISSIONS.PUBLICATIONS.SUBMIT,

        /*
         * Notifications
         */
        PERMISSIONS.NOTIFICATIONS.READ_SELF,
        PERMISSIONS.NOTIFICATIONS.MANAGE_SELF,
      ],
    },

    /*
    |--------------------------------------------------------------------------
    | MENTOR / EXPERT
    |--------------------------------------------------------------------------
    */

    {
      code:
        SYSTEM_ROLE_CODES.MENTOR_EXPERT,
    
      name:
        'Mentor / Expert',
    
      description:
        'Diaspora mentor or expert participating in talent and mentorship activities.',
    
      scope:
        RoleScope.GLOBAL,
    
      isSystem:
        true,
    
      permissions: [
        /*
         * Own talent profile
         */
    
        PERMISSIONS.TALENT
          .PROFILES_MANAGE_SELF,
    
        /*
         * Talent discovery
         */
    
        PERMISSIONS.TALENT.PROFILES_READ,
    
        /*
         * Mentorship
         */
    
        PERMISSIONS.TALENT
          .MENTORSHIP_HANDLE,
      ],
    },
  ];