import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MovieService } from '../../services/movie.service';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  template: `
    <section class="auth-page">
      <p class="eyebrow eyebrow-coral">Welcome back</p>
      <h1>Log in</h1>
      <p class="auth-description">Sign in to continue exploring movies.</p>

      <form class="auth-form" (submit)="login($event, emailInput.value, passwordInput.value)">
        <div class="form-field">
          <label for="login-email">Email</label>
          <input #emailInput id="login-email" name="email" type="email" autocomplete="email" required />
        </div>
        <div class="form-field">
          <label for="login-password">Password</label>
          <input #passwordInput id="login-password" name="password" type="password" autocomplete="current-password" required />
        </div>
        <button class="button button-dark" type="submit" [disabled]="loading()">
          {{ loading() ? 'Logging in...' : 'Log in' }}
        </button>
      </form>

      @if (error()) {
        <p class="form-feedback error-message" role="alert">{{ error() }}</p>
      }

      <p class="auth-switch">New here? <a routerLink="/register">Create an account</a></p>
    </section>
  `,
})
export class LoginComponent {
  private readonly movieService = inject(MovieService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly error = signal('');

  login(event: SubmitEvent, email: string, password: string): void {
    event.preventDefault();
    this.loading.set(true);
    this.error.set('');

    this.movieService.login(email.trim(), password).subscribe({
      next: (response) => {
        if (!response.token) {
          this.error.set('Login did not return a session. Please try again.');
          this.loading.set(false);
          return;
        }

        this.authService.setSession(response.user, response.token);
        this.loading.set(false);
        void this.router.navigateByUrl('/');
      },
      error: (requestError: HttpErrorResponse) => {
        this.error.set(requestError.error?.message || 'Could not log in. Please try again.');
        this.loading.set(false);
      },
    });
  }
}