/*
|--------------------------------------------------------------------------
| MINREX MVP PERMISSIONS
|--------------------------------------------------------------------------
|
| Permission naming convention:
|
|   domain.resource.action
|
| Examples:
|
|   identity.users.read
|   census.records.verify
|   assistance.cases.update
|
| These permissions are the source of truth for the MVP authorization
| layer. They will later be seeded into PostgreSQL.
|
*/

export const PERMISSIONS = {
  /*
  |--------------------------------------------------------------------------
  | IDENTITY
  |--------------------------------------------------------------------------
  */

  IDENTITY: {
    USERS_READ: 'identity.users.read',

    USERS_MANAGE: 'identity.users.manage',
  },

  /*
  |--------------------------------------------------------------------------
  | ACCESS CONTROL
  |--------------------------------------------------------------------------
  */

  ACCESS: {
    ROLES_READ: 'access.roles.read',

    ROLES_MANAGE: 'access.roles.manage',

    ROLES_ASSIGN: 'access.roles.assign',

    PERMISSIONS_READ: 'access.permissions.read',
  },

  /*
  |--------------------------------------------------------------------------
  | DIPLOMATIC NETWORK
  |--------------------------------------------------------------------------
  */

  NETWORK: {
    POSTS_READ: 'network.posts.read',
  },

  /*
  |--------------------------------------------------------------------------
  | CENSUS / RECENSEMENT
  |--------------------------------------------------------------------------
  */

  CENSUS: {
    RECORDS_CREATE: 'census.records.create',

    RECORDS_READ_SELF: 'census.records.read.self',

    RECORDS_READ: 'census.records.read',

    RECORDS_REVIEW: 'census.records.review',

    RECORDS_REQUEST_CORRECTION:
      'census.records.request_correction',

    RECORDS_VERIFY: 'census.records.verify',
  },

  /*
  |--------------------------------------------------------------------------
  | CONSULAR ASSISTANCE
  |--------------------------------------------------------------------------
  */

  ASSISTANCE: {
    CASES_CREATE: 'assistance.cases.create',

    CASES_READ_SELF: 'assistance.cases.read.self',

    CASES_READ: 'assistance.cases.read',

    CASES_ASSIGN: 'assistance.cases.assign',

    CASES_UPDATE: 'assistance.cases.update',

    CASES_CLOSE: 'assistance.cases.close',
  },

  /*
  |--------------------------------------------------------------------------
  | TALENT & MENTORSHIP
  |--------------------------------------------------------------------------
  */

  TALENT: {
    PROFILES_MANAGE_SELF:
      'talent.profiles.manage.self',

    PROFILES_READ:
      'talent.profiles.read',

    MENTORSHIP_REQUEST:
      'talent.mentorship.request',

    MENTORSHIP_MANAGE:
      'talent.mentorship.manage',
  },
} as const;

/*
|--------------------------------------------------------------------------
| PERMISSION CODE TYPE
|--------------------------------------------------------------------------
|
| This creates a TypeScript union of every valid permission code.
|
| This prevents us from accidentally writing:
|
|   assistance.case.read
|
| instead of:
|
|   assistance.cases.read
|
*/

export type PermissionCode =
  | (typeof PERMISSIONS.IDENTITY)[keyof typeof PERMISSIONS.IDENTITY]
  | (typeof PERMISSIONS.ACCESS)[keyof typeof PERMISSIONS.ACCESS]
  | (typeof PERMISSIONS.NETWORK)[keyof typeof PERMISSIONS.NETWORK]
  | (typeof PERMISSIONS.CENSUS)[keyof typeof PERMISSIONS.CENSUS]
  | (typeof PERMISSIONS.ASSISTANCE)[keyof typeof PERMISSIONS.ASSISTANCE]
  | (typeof PERMISSIONS.TALENT)[keyof typeof PERMISSIONS.TALENT];

/*
|--------------------------------------------------------------------------
| PERMISSION DEFINITION
|--------------------------------------------------------------------------
|
| This structure will be reused by the Prisma seed.
|
*/

export interface PermissionDefinition {
  code: PermissionCode;
  name: string;
  description: string;
}

/*
|--------------------------------------------------------------------------
| SYSTEM PERMISSION CATALOGUE
|--------------------------------------------------------------------------
|
| These are the permissions that will actually be inserted into
| PostgreSQL by our Prisma seed.
|
*/

export const SYSTEM_PERMISSIONS:
  readonly PermissionDefinition[] = [
    /*
    |--------------------------------------------------------------------------
    | Identity
    |--------------------------------------------------------------------------
    */

    {
      code: PERMISSIONS.IDENTITY.USERS_READ,

      name: 'Read users',

      description:
        'Allows access to user account and profile information.',
    },

    {
      code: PERMISSIONS.IDENTITY.USERS_MANAGE,

      name: 'Manage users',

      description:
        'Allows administrative management of user accounts and account status.',
    },

    /*
    |--------------------------------------------------------------------------
    | Access Control
    |--------------------------------------------------------------------------
    */

    {
      code: PERMISSIONS.ACCESS.ROLES_READ,

      name: 'Read roles',

      description:
        'Allows viewing available roles and their configuration.',
    },

    {
      code: PERMISSIONS.ACCESS.ROLES_MANAGE,

      name: 'Manage roles',

      description:
        'Allows administrative management of roles.',
    },

    {
      code: PERMISSIONS.ACCESS.ROLES_ASSIGN,

      name: 'Assign roles',

      description:
        'Allows assigning and revoking role assignments for users.',
    },

    {
      code:
        PERMISSIONS.ACCESS.PERMISSIONS_READ,

      name: 'Read permissions',

      description:
        'Allows viewing the MINREX permission catalogue.',
    },

    /*
    |--------------------------------------------------------------------------
    | Diplomatic Network
    |--------------------------------------------------------------------------
    */

    {
      code: PERMISSIONS.NETWORK.POSTS_READ,

      name: 'Read diplomatic posts',

      description:
        'Allows viewing diplomatic posts and their basic organizational information.',
    },

    /*
    |--------------------------------------------------------------------------
    | Census
    |--------------------------------------------------------------------------
    */

    {
      code:
        PERMISSIONS.CENSUS.RECORDS_CREATE,

      name: 'Create census record',

      description:
        'Allows a diaspora member to create a census record.',
    },

    {
      code:
        PERMISSIONS.CENSUS.RECORDS_READ_SELF,

      name: 'Read own census record',

      description:
        'Allows a diaspora member to view their own census record.',
    },

    {
      code:
        PERMISSIONS.CENSUS.RECORDS_READ,

      name: 'Read census records',

      description:
        'Allows authorized MINREX personnel to view census records within their authorization scope.',
    },

    {
      code:
        PERMISSIONS.CENSUS.RECORDS_REVIEW,

      name: 'Review census records',

      description:
        'Allows authorized personnel to review submitted census records.',
    },

    {
      code:
        PERMISSIONS.CENSUS
          .RECORDS_REQUEST_CORRECTION,

      name: 'Request census correction',

      description:
        'Allows authorized personnel to request corrections to a submitted census record.',
    },

    {
      code:
        PERMISSIONS.CENSUS.RECORDS_VERIFY,

      name: 'Verify census records',

      description:
        'Allows authorized personnel to validate a census record after review.',
    },

    /*
    |--------------------------------------------------------------------------
    | Assistance & Protection
    |--------------------------------------------------------------------------
    */

    {
      code:
        PERMISSIONS.ASSISTANCE.CASES_CREATE,

      name: 'Create assistance case',

      description:
        'Allows a diaspora member to submit a consular assistance request.',
    },

    {
      code:
        PERMISSIONS.ASSISTANCE.CASES_READ_SELF,

      name: 'Read own assistance cases',

      description:
        'Allows a diaspora member to view and follow their own assistance requests.',
    },

    {
      code:
        PERMISSIONS.ASSISTANCE.CASES_READ,

      name: 'Read assistance cases',

      description:
        'Allows authorized personnel to view assistance cases within their authorization scope.',
    },

    {
      code:
        PERMISSIONS.ASSISTANCE.CASES_ASSIGN,

      name: 'Assign assistance cases',

      description:
        'Allows authorized personnel to assign assistance cases for handling.',
    },

    {
      code:
        PERMISSIONS.ASSISTANCE.CASES_UPDATE,

      name: 'Update assistance cases',

      description:
        'Allows authorized personnel to update the processing and status of assistance cases.',
    },

    {
      code:
        PERMISSIONS.ASSISTANCE.CASES_CLOSE,

      name: 'Close assistance cases',

      description:
        'Allows authorized personnel to resolve and close assistance cases.',
    },

    /*
    |--------------------------------------------------------------------------
    | Talent & Mentorship
    |--------------------------------------------------------------------------
    */

    {
      code:
        PERMISSIONS.TALENT
          .PROFILES_MANAGE_SELF,

      name: 'Manage own talent profile',

      description:
        'Allows a user to create and update their own talent profile.',
    },

    {
      code:
        PERMISSIONS.TALENT.PROFILES_READ,

      name: 'Read talent profiles',

      description:
        'Allows authorized users to consult talent profiles.',
    },

    {
      code:
        PERMISSIONS.TALENT
          .MENTORSHIP_REQUEST,

      name: 'Request mentorship',

      description:
        'Allows an eligible user to submit a mentorship request.',
    },

    {
      code:
        PERMISSIONS.TALENT
          .MENTORSHIP_MANAGE,

      name: 'Manage mentorship',

      description:
        'Allows authorized mentors or MINREX personnel to manage mentorship activities.',
    },
  ];