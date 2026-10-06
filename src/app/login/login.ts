import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../auth/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['ada@silhouette.dev', Validators.required],
    password: ['silhouette', Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.pending.set(true);
    const { email, password } = this.form.getRawValue();

    this.auth
      .signIn(email, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => window.location.assign('/'),
        error: (err: unknown) => {
          this.pending.set(false);
          this.error.set(messageFrom(err));
        },
      });
  }
}

function messageFrom(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
    const message = (error.error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return 'Nie udało się zalogować.';
}
