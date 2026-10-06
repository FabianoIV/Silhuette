import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth/auth';
import { LogoMark } from '../logo-mark/logo-mark';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LogoMark],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly auth = inject(AuthService);

  protected leave(): void {
    this.auth.leave();
  }
}
