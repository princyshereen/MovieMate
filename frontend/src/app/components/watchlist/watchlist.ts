import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService, AuthenticatedUser } from '../../services/auth.service';
import { Movie, MovieService } from '../../services/movie.service';

@Component({
  selector: 'app-watchlist',
  imports: [RouterLink],
  template: `
    <section class="page-shell">
      <div class="page-heading">
        <div>
          <p class="eyebrow eyebrow-coral">Saved for later</p>
          <h1>My Watchlist</h1>
        </div>
      </div>

      @if (loading()) {
        <p class="state-message" role="status">Loading your watchlist...</p>
      } @else if (error()) {
        <p class="state-message state-error" role="alert">{{ error() }}</p>
      } @else if (movies().length === 0) {
        <div class="empty-watchlist">
          <h2>Your watchlist is empty</h2>
          <p>Find a movie you like and save it here for later.</p>
          <a class="button button-dark" routerLink="/movies">Browse movies</a>
        </div>
      } @else {
        <div class="movie-grid">
          @for (movie of movies(); track movie.id) {
            <article class="movie-card">
              <a class="poster-wrap" [routerLink]="['/movies', movie.id]" [attr.aria-label]="'View details for ' + movie.title">
                @if (movie.poster) {
                  <img [src]="movie.poster" [alt]="'Poster for ' + movie.title" />
                } @else {
                  <div class="poster-placeholder">{{ movie.title }}</div>
                }
              </a>
              <div class="movie-card-body">
                <div class="movie-card-title-row">
                  <h2>{{ movie.title }}</h2>
                  <span class="rating">{{ movie.rating ?? 'N/A' }}</span>
                </div>
                <p class="release-date">{{ movie.releaseDate || 'Release date unavailable' }}</p>
                <div class="watchlist-actions">
                  <a class="details-link" [routerLink]="['/movies', movie.id]">View details <span aria-hidden="true">&#8594;</span></a>
                  <button class="remove-button" type="button" [disabled]="removingId() === movie.id" (click)="removeMovie(movie.id)">
                    {{ removingId() === movie.id ? 'Removing...' : 'Remove' }}
                  </button>
                </div>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class WatchlistComponent implements OnInit {
  private readonly movieService = inject(MovieService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly movies = signal<Movie[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly removingId = signal<string | null>(null);
  private currentUser: AuthenticatedUser | null = null;

  ngOnInit(): void {
    this.currentUser = this.authService.currentUser();
    if (!this.currentUser) {
      void this.router.navigateByUrl('/login');
      return;
    }

    this.loadWatchlist();
  }

  removeMovie(movieId: string): void {
    if (!this.currentUser) {
      void this.router.navigateByUrl('/login');
      return;
    }

    this.removingId.set(movieId);
    this.error.set('');

    this.movieService.removeFromWatchlist(this.currentUser.id, movieId, this.currentUser.token).subscribe({
      next: () => {
        this.movies.update((movies) => movies.filter((movie) => movie.id !== movieId));
        this.removingId.set(null);
      },
      error: (requestError: HttpErrorResponse) => {
        this.error.set(requestError.error?.message || 'Could not remove this movie.');
        this.removingId.set(null);
      },
    });
  }

  private loadWatchlist(): void {
    if (!this.currentUser) {
      return;
    }

    this.movieService.getWatchlist(this.currentUser.id, this.currentUser.token).subscribe({
      next: (movies) => {
        this.movies.set(movies);
        this.loading.set(false);
      },
      error: (requestError: HttpErrorResponse) => {
        this.error.set(requestError.error?.message || 'Could not load your watchlist.');
        this.loading.set(false);
      },
    });
  }
}