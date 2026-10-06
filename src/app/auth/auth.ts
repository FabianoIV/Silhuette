import { isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Injectable,
  PLATFORM_ID,
  REQUEST_CONTEXT,
  TransferState,
  inject,
  makeStateKey,
  signal,
} from '@angular/core';
import { readAuthContext, type SessionUser } from './session-user';

const SESSION_STATE_KEY = makeStateKey<SessionUser | null>('silhouette.session');

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly transferState = inject(TransferState);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly requestContext = inject(REQUEST_CONTEXT, { optional: true });

  readonly user = signal<SessionUser | null>(this.restore());
  readonly leaving = signal(false);

  leave(): void {
    if (this.leaving()) {
      return;
    }

    this.leaving.set(true);
    this.http.post('/api/logout', {}).subscribe({
      next: () => {
        this.user.set(null);
        window.location.assign('/login');
      },
      error: () => this.leaving.set(false),
    });
  }

  private restore(): SessionUser | null {
    if (isPlatformServer(this.platformId)) {
      const user = readAuthContext(this.requestContext);
      this.transferState.set(SESSION_STATE_KEY, user);
      return user;
    }

    const user = this.transferState.get(SESSION_STATE_KEY, null);
    this.transferState.remove(SESSION_STATE_KEY);
    return user;
  }
}
