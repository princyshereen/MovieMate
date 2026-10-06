import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Movie, MovieService } from '../../services/movie.service';

@Component({
  selector: 'app-movies',
  imports: [RouterLink],
  template: `
    <section class="page-shell">
      <div class="page-heading">
        <div>
          <p class="eyebrow eyebrow-coral">Pick your next watch</p>
          <h1>Movies</h1>
        </div>
        <form class="search-form" (submit)="searchMovies($event, searchInput.value)">
          <label class="visually-hidden" for="movie-search">Search movies</label>
          <input #searchInput id="movie-search" type="search" placeholder="Search movies" />
          <button class="button button-dark" type="submit">Search</button>
        </form>
      </div>

      @if (searchNotice()) {
        <p class="state-message" role="status">{{ searchNotice() }}</p>
      }

      @if (loading()) {
        <p class="state-message" role="status">Loading movies...</p>
      } @else if (error()) {
        <p class="state-message state-error" role="alert">{{ error() }}</p>
      } @else if (movies().length === 0) {
        <p class="state-message">No movies found. Try another search.</p>
      } @else {
        <div class="movie-grid">
          @for (movie of movies(); track movie.id) {
            <article class="movie-card">
              <a class="poster-wrap" [routerLink]="['/movies', movie.id]" [attr.aria-label]="'View details for ' + movie.title">
                @if (movie.poster) {
                  <img [src]="movie.poster" [alt]="'Poster for ' + movie.title" />
                } @else {
                  <div class="poster-placeholder" aria-label="No poster available">{{ movie.title }}</div>
                }
              </a>
              <div class="movie-card-body">
                <div class="movie-card-title-row">
                  <h2>{{ movie.title }}</h2>
                  @if (movie.rating !== null) {
                    <span class="rating">{{ movie.rating }}</span>
                  }
                </div>
                <p class="release-date">{{ movie.releaseDate || 'Release date unavailable' }}</p>
                <a class="details-link" [routerLink]="['/movies', movie.id]">View details <span aria-hidden="true">&#8594;</span></a>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class MoviesComponent implements OnInit {
  private readonly movieService = inject(MovieService);
  readonly movies = signal<Movie[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly searchNotice = signal('');

  ngOnInit(): void {
    this.loadMovies();
  }

  searchMovies(event: SubmitEvent, query: string): void {
    event.preventDefault();
    const searchTerm = query.trim();

    if (!searchTerm) {
      this.searchNotice.set('Enter a movie name to search. Showing the default results.');
      this.loadMovies();
      return;
    }

    this.searchNotice.set('');
    this.loadMovies(searchTerm);
  }

  private loadMovies(query = ''): void {
    this.loading.set(true);
    this.error.set('');

    const request = query
      ? this.movieService.searchMovies(query)
      : this.movieService.getMovies();

    request.subscribe({
      next: (movies) => {
        this.movies.set(movies);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load movies. Check the backend and OMDb API key.');
        this.loading.set(false);
      },
    });
  }
}