import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Movie, MovieService } from '../../services/movie.service';

@Component({
  selector: 'app-movie-details',
  imports: [RouterLink],
  template: `
    <section class="page-shell details-page">
      <a class="back-link" routerLink="/movies">&#8592; Back to movies</a>

      @if (loading()) {
        <p class="state-message" role="status">Loading movie...</p>
      } @else if (error()) {
        <p class="state-message state-error" role="alert">{{ error() }}</p>
      } @else if (movie(); as selectedMovie) {
        <div class="details-layout">
          <div class="details-poster">
            @if (selectedMovie.poster) {
              <img [src]="selectedMovie.poster" [alt]="'Poster for ' + selectedMovie.title" />
            } @else {
              <div class="poster-placeholder">{{ selectedMovie.title }}</div>
            }
          </div>
          <div class="details-copy">
            <p class="eyebrow eyebrow-coral">Movie details</p>
            <h1>{{ selectedMovie.title }}</h1>
            <div class="details-meta">
              <span class="rating">Rating {{ selectedMovie.rating ?? 'N/A' }}</span>
              <span>{{ selectedMovie.releaseDate || 'Release date unavailable' }}</span>
            </div>
            <h2>Overview</h2>
            <p class="overview">{{ selectedMovie.overview || 'No overview is available for this movie.' }}</p>
            <button class="button button-dark" type="button" [disabled]="watchlistLoading()" (click)="addToWatchlist()">
              {{ watchlistLoading() ? 'Adding...' : 'Add to Watchlist' }}
            </button>
            @if (watchlistMessage()) {
              <p class="watchlist-notice" role="status">{{ watchlistMessage() }}</p>
            }
            @if (watchlistError()) {
              <p class="watchlist-error" role="alert">{{ watchlistError() }}</p>
            }
          </div>
        </div>
      }
    </section>
  `,
})
export class MovieDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly movieService = inject(MovieService);
  readonly movie = signal<Movie | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly watchlistLoading = signal(false);
  readonly watchlistMessage = signal('');
  readonly watchlistError = signal('');

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      this.loading.set(true);
      this.error.set('');

      if (!id || !/^tt\d+$/.test(id)) {
        this.error.set('Movie not found.');
        this.loading.set(false);
        return;
      }

      this.movieService.getMovie(id).subscribe({
        next: (movie) => {
          this.movie.set(movie);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load movie details. Check the backend and OMDb API key.');
          this.loading.set(false);
        },
      });
    });
  }

  addToWatchlist(): void {
    const user = this.authService.currentUser();
    if (!user) {
      void this.router.navigateByUrl('/login');
      return;
    }

    const movie = this.movie();
    if (!movie) {
      this.watchlistError.set('Could not identify your account or movie.');
      this.watchlistMessage.set('');
      return;
    }

    this.watchlistLoading.set(true);
    this.watchlistMessage.set('');
    this.watchlistError.set('');

    this.movieService.addToWatchlist(user.id, movie, user.token).subscribe({
      next: (response) => {
        this.watchlistMessage.set(response.message);
        this.watchlistLoading.set(false);
      },
      error: (requestError) => {
        this.watchlistError.set(requestError.error?.message || 'Could not update your watchlist.');
        this.watchlistLoading.set(false);
      },
    });
  }
}