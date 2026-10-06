import { Component, inject } from '@angular/core';
import { AuthService } from '../../auth/auth';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  protected readonly auth = inject(AuthService);
}
