import { type PatAuthContext } from './auth';

export function hasPatScope(auth: PatAuthContext, scope: string): boolean {
  return auth.scopes.includes(scope);
}

export function hasAnyPatScope(auth: PatAuthContext, scopes: string[]): boolean {
  return scopes.some((scope) => hasPatScope(auth, scope));
}
