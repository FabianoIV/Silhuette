import { isPlatformServer } from '@angular/common';
import { PLATFORM_ID, REQUEST, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';

export const authGuard: CanActivateFn = () => {
  if (allowDuringBuildExtraction()) {
    return true;
  }

  if (inject(AuthService).user()) {
    return true;
  }

  return inject(Router).createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = () => {
  if (allowDuringBuildExtraction()) {
    return true;
  }

  if (!inject(AuthService).user()) {
    return true;
  }

  return inject(Router).createUrlTree(['/']);
};

/**
 * Production builds discover routes by bootstrapping the server app without an HTTP request.
 * A missing `REQUEST` token means that phase, not an anonymous visitor.
 * In the browser `REQUEST` is also absent, but the platform is not the server.
 */
function allowDuringBuildExtraction(): boolean {
  return isPlatformServer(inject(PLATFORM_ID)) && !inject(REQUEST, { optional: true });
}
