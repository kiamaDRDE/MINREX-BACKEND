import { SetMetadata } from '@nestjs/common';

import type { AuthorizationScopeMetadata } from '../interfaces/authorization-context.interface.js';

export const AUTHORIZATION_SCOPE_KEY =
  'authorization_scope';

export const AuthorizationScope = (
  metadata: AuthorizationScopeMetadata,
) =>
  SetMetadata(
    AUTHORIZATION_SCOPE_KEY,
    metadata,
  );
  