import { Component, inject } from '@angular/core';
import { AuthService } from '../../auth/auth';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
})
export class Settings {
  protected readonly auth = inject(AuthService);

  protected leave(): void {
    this.auth.leave();
  }
}
