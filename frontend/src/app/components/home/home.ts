import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Movie, MovieService } from '../../services/movie.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="home-hero">
      <div class="hero-content">
        <p class="eyebrow">A little more movie in your day</p>
        <h1>Movie Explorer</h1>
        <p class="hero-description">
          An explainable recommendation system for curious viewers who want meaningful discovery over random suggestions.
        </p>
        <div class="hero-actions">
          <a class="button button-lime" routerLink="/movies">
            Browse movies <span aria-hidden="true">&#8594;</span>
          </a>
          @if (auth.isLoggedIn()) {
            <a class="button button-dark" routerLink="/recommendations">
              Open recommendations
            </a>
          } @else {
            <a class="button button-dark" routerLink="/register">
              Build my profile
            </a>
          }
        </div>
      </div>
      <div class="hero-caption" aria-hidden="true">EXPLAINABLE. CULTURALLY AWARE. USER CONTROLLED.</div>
    </section>

    <section class="home-intro">
      <div>
        <p class="eyebrow eyebrow-coral">Research-driven discovery</p>
        <h2>Cold-start aware, language-aware, and diversity-aware.</h2>
      </div>
      <a class="text-link" routerLink="/recommendations">Explore the recommendation engine <span aria-hidden="true">&#8594;</span></a>
    </section>

    <section class="feature-grid">
      <div class="feature-card">
        <p class="eyebrow eyebrow-coral">Cold start</p>
        <h3>Onboarding profile</h3>
        <p>New users choose languages, genres, and a few favorite movies to build a stronger initial recommendation profile.</p>
      </div>
      <div class="feature-card">
        <p class="eyebrow eyebrow-coral">Explainability</p>
        <h3>Transparent reasons</h3>
        <p>Each recommendation comes with an explanation tied to actual alignment with language, genre, and watchlist signals.</p>
      </div>
      <div class="feature-card">
        <p class="eyebrow eyebrow-coral">User controls</p>
        <h3>Adjust the ranking</h3>
        <p>Users can steer the system toward Tamil, English, more action, more romance, or a broader discovery mix.</p>
      </div>
    </section>

    <section class="regional-section">
      <div class="section-header">
        <div>
          <p class="eyebrow eyebrow-coral">Discover regional cinema</p>
          <h2>Regional highlights</h2>
        </div>
        <a class="text-link" routerLink="/movies">Browse all movies <span aria-hidden="true">&#8594;</span></a>
      </div>

      @if (loadingRegional()) {
        <p class="state-message" role="status">Loading regional cinema recommendations...</p>
      } @else if (regionalCinema().length === 0) {
        <p class="state-message">Regional cinema picks are unavailable right now.</p>
      } @else {
        <div class="movie-grid compact-grid">
          @for (movie of regionalCinema(); track movie.id) {
            <article class="movie-card">
              <a class="poster-wrap" [routerLink]="['/movies', movie.id]">
                @if (movie.poster) {
                  <img [src]="movie.poster" [alt]="'Poster for ' + movie.title" />
                } @else {
                  <div class="poster-placeholder">{{ movie.title }}</div>
                }
              </a>
              <div class="movie-card-body">
                <div class="movie-card-title-row">
                  <h2>{{ movie.title }}</h2>
                  @if (movie.rating !== null) {
                    <span class="rating">{{ movie.rating }}</span>
                  }
                </div>
                <p class="release-date">{{ movie.language || 'Regional cinema' }} • {{ movie.releaseDate || 'Unknown year' }}</p>
                <a class="details-link" [routerLink]="['/movies', movie.id]">View details <span aria-hidden="true">&#8594;</span></a>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class HomeComponent implements OnInit {
  private readonly movieService = inject(MovieService);
  readonly auth = inject(AuthService);
  readonly regionalCinema = signal<Movie[]>([]);
  readonly loadingRegional = signal(true);

  ngOnInit(): void {
    this.movieService.getRegionalCinema('Tamil').subscribe({
      next: (movies) => {
        this.regionalCinema.set(movies.slice(0, 4));
        this.loadingRegional.set(false);
      },
      error: () => {
        this.loadingRegional.set(false);
      },
    });
  }
}