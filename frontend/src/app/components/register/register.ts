import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MovieService } from '../../services/movie.service';

@Component({
  selector: 'app-register',
  imports: [RouterLink],
  template: `
    <section class="auth-page">
      <p class="eyebrow eyebrow-coral">Join the movie club</p>
      <h1>Create account</h1>
      <p class="auth-description">Make an account to get started with Movie Explorer.</p>

      <form class="auth-form" (submit)="register($event, nameInput.value, emailInput.value, passwordInput.value)">
        <div class="form-field">
          <label for="register-name">Name</label>
          <input #nameInput id="register-name" name="name" type="text" autocomplete="name" required />
        </div>
        <div class="form-field">
          <label for="register-email">Email</label>
          <input #emailInput id="register-email" name="email" type="email" autocomplete="email" required />
        </div>
        <div class="form-field">
          <label for="register-password">Password</label>
          <input #passwordInput id="register-password" name="password" type="password" autocomplete="new-password" minlength="6" required />
          <span class="field-hint">At least 6 characters</span>
        </div>
        <button class="button button-dark" type="submit" [disabled]="loading()">
          {{ loading() ? 'Creating account...' : 'Register' }}
        </button>
      </form>

      @if (success()) {
        <p class="form-feedback success-message" role="status">{{ success() }}</p>
      }
      @if (error()) {
        <p class="form-feedback error-message" role="alert">{{ error() }}</p>
      }

      <p class="auth-switch">Already registered? <a routerLink="/login">Log in</a></p>
    </section>
  `,
})
export class RegisterComponent {
  private readonly movieService = inject(MovieService);
  readonly loading = signal(false);
  readonly success = signal('');
  readonly error = signal('');

  register(event: SubmitEvent, name: string, email: string, password: string): void {
    event.preventDefault();
    this.loading.set(true);
    this.success.set('');
    this.error.set('');

    this.movieService.register(name.trim(), email.trim(), password).subscribe({
      next: () => {
        this.success.set('Registration successful. You can now log in.');
        this.loading.set(false);
      },
      error: (requestError: HttpErrorResponse) => {
        this.error.set(requestError.error?.message || 'Could not register. Please try again.');
        this.loading.set(false);
      },
    });
  }
}