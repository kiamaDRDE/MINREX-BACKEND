export type AuthorizationResource =
  | 'association'
  | 'publication';

export interface AuthorizationContext {
  postId?: string;
  serviceId?: string;

  /**
   * Autorise la vérification d'une permission POST
   * lorsqu'une route travaille sur la file de tous
   * les postes attribués à l'utilisateur.
   *
   * Le service doit ensuite filtrer les résultats
   * sur les postes réellement attribués.
   */
  allowAnyPost?: boolean;
}

export interface AuthorizationScopeMetadata {
  postParam?: string;
  serviceParam?: string;

  /**
   * Ressource dont le poste doit être résolu
   * depuis son identifiant ou son slug.
   */
  resource?: AuthorizationResource;
  resourceIdParam?: string;

  /**
   * Route de file d'attente limitée aux postes
   * attribués à l'utilisateur.
   */
  allowAssignedPosts?: boolean;
}