import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="site-header">
      <div class="navbar">
        <a class="brand" routerLink="/" aria-label="Movie Explorer home">
          <span class="brand-mark" aria-hidden="true">M</span>
          <span>Movie Explorer</span>
        </a>

        <nav class="nav-links" aria-label="Main navigation">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
          <a routerLink="/movies" routerLinkActive="active">Movies</a>
          @if (auth.isLoggedIn()) {
            <a routerLink="/watchlist" routerLinkActive="active">Watchlist</a>
            <button class="nav-action" type="button" (click)="logout()">Logout</button>
          } @else {
            <a routerLink="/login" routerLinkActive="active">Login</a>
            <a routerLink="/register" routerLinkActive="active">Register</a>
          }
        </nav>
      </div>
    </header>
  `,
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}