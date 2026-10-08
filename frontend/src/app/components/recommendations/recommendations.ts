import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MovieService, Recommendation } from '../../services/movie.service';

const supportedLanguages = ['Tamil', 'English', 'Hindi', 'Telugu', 'Malayalam', 'Kannada'];
const supportedGenres = ['Action', 'Drama', 'Comedy', 'Adventure', 'Romance', 'Thriller', 'Sci-Fi', 'Family'];

@Component({
  selector: 'app-recommendations',
  imports: [RouterLink],
  template: `
    <section class="page-shell recommendations-page">
      <div class="page-heading">
        <div>
          <p class="eyebrow eyebrow-coral">Recommendation engine</p>
          <h1>My recommendations</h1>
        </div>
      </div>

      <div class="recommendation-layout">
        <aside class="recommendation-panel">
          <h2>Cold-start profile</h2>
          <p class="panel-copy">Choose a few languages, genres, and movies you want more of.</p>

          <div class="tag-selector">
            <span class="selector-label">Languages</span>
            <div class="chip-group">
              @for (language of supportedLanguages; track language) {
                <button
                  type="button"
                  class="chip"
                  [class.selected]="preferredLanguages().includes(language)"
                  (click)="toggleSelection(preferredLanguages, language)"
                >
                  {{ language }}
                </button>
              }
            </div>
          </div>

          <div class="tag-selector">
            <span class="selector-label">Genres</span>
            <div class="chip-group">
              @for (genre of supportedGenres; track genre) {
                <button
                  type="button"
                  class="chip"
                  [class.selected]="preferredGenres().includes(genre)"
                  (click)="toggleSelection(preferredGenres, genre)"
                >
                  {{ genre }}
                </button>
              }
            </div>
          </div>

          <label class="field-label" for="favorite-titles">Favorite movie titles</label>
          <input id="favorite-titles" type="text" class="inline-input" [value]="favoriteTitlesInput()" (input)="favoriteTitlesInput.set($any($event.target).value)" placeholder="Example: 96, Dune, RRR" />

          <div class="panel-actions">
            <button class="button button-dark" type="button" (click)="saveProfile()" [disabled]="saving()">
              {{ saving() ? 'Saving...' : 'Save profile' }}
            </button>
          </div>

          @if (formMessage()) {
            <p class="form-feedback" [class.success-message]="formSuccess()" [class.error-message]="!formSuccess()">{{ formMessage() }}</p>
          }
        </aside>

        <div class="recommendations-panel">
          <div class="recommendation-controls">
            <h2>Recommendation focus</h2>
            <div class="chip-group narrow">
              @for (control of controlOptions; track control) {
                <button
                  type="button"
                  class="chip"
                  [class.selected]="selectedControl() === control.value"
                  (click)="setControl(control.value)"
                >
                  {{ control.label }}
                </button>
              }
            </div>
          </div>

          @if (loading()) {
            <p class="state-message" role="status">Generating your recommendation mix…</p>
          } @else if (error()) {
            <p class="state-message state-error" role="alert">{{ error() }}</p>
          } @else if (recommendations().length === 0) {
            <p class="state-message">No recommendations are available yet. Update your preferences to seed the recommender.</p>
          } @else {
            <div class="recommendation-list">
              @for (movie of recommendations(); track movie.id) {
                <article class="recommendation-card">
                  <div class="recommendation-poster">
                    @if (movie.poster) {
                      <img [src]="movie.poster" [alt]="'Poster for ' + movie.title" />
                    } @else {
                      <div class="poster-placeholder">{{ movie.title }}</div>
                    }
                  </div>
                  <div class="recommendation-copy">
                    <div class="movie-card-title-row">
                      <h3>{{ movie.title }}</h3>
                      <span class="rating">{{ movie.rating ?? 'N/A' }}</span>
                    </div>
                    <p class="release-date">{{ movie.language || 'Language not listed' }} • {{ movie.releaseDate || 'Unknown year' }}</p>
                    <p class="recommendation-score">Score {{ movie.score ?? 0 }}</p>
                    <p class="recommendation-explanation">{{ movie.explanation }}</p>
                    <div class="recommendation-actions">
                      <a class="details-link" [routerLink]="['/movies', movie.id]">View details <span aria-hidden="true">&#8594;</span></a>
                    </div>
                  </div>
                </article>
              }
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class RecommendationsComponent implements OnInit {
  private readonly movieService = inject(MovieService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly supportedLanguages = supportedLanguages;
  readonly supportedGenres = supportedGenres;
  readonly controlOptions = [
    { label: 'Balanced', value: 'balanced' },
    { label: 'More Tamil', value: 'more-tamil' },
    { label: 'More English', value: 'more-english' },
    { label: 'More popular', value: 'more-popular' },
    { label: 'Discover new', value: 'discover-new' },
    { label: 'More action', value: 'more-action' },
    { label: 'More romance', value: 'more-romance' },
  ];

  readonly preferredLanguages = signal<string[]>([]);
  readonly preferredGenres = signal<string[]>([]);
  readonly favoriteTitlesInput = signal('');
  readonly recommendations = signal<Recommendation[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly formMessage = signal('');
  readonly formSuccess = signal(false);
  readonly selectedControl = signal('balanced');

  readonly user = computed(() => this.authService.currentUser());

  ngOnInit(): void {
    const user = this.user();
    if (!user) {
      void this.router.navigateByUrl('/login');
      return;
    }

    this.loadProfile();
  }

  toggleSelection(target: ReturnType<typeof signal<string[]>>, value: string): void {
    const current = target();
    target.set(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  setControl(control: string): void {
    this.selectedControl.set(control);
    const user = this.user();
    if (!user) {
      return;
    }

    this.loadRecommendations(user.id, user.token, control);
  }

  saveProfile(): void {
    const user = this.user();
    if (!user) {
      void this.router.navigateByUrl('/login');
      return;
    }

    this.saving.set(true);
    this.formMessage.set('');

    const favorites = this.favoriteTitlesInput()
      .split(',')
      .map((title) => title.trim())
      .filter(Boolean)
      .slice(0, 6);

    this.movieService.savePreferences(user.id, user.token, {
      preferredLanguages: this.preferredLanguages(),
      preferredGenres: this.preferredGenres(),
      favoriteMovieTitles: favorites,
      recommendationControls: {
        focus: this.selectedControl(),
        languageBoost: this.selectedControl(),
        genreBoost: this.preferredGenres()[0] || '',
        diversityBias: 0.5,
        noveltyBias: 0.5,
        popularityBias: 0.5,
      },
    }).subscribe({
      next: () => {
        this.formMessage.set('Recommendation profile saved. Updating suggestions...');
        this.formSuccess.set(true);
        this.saving.set(false);
        this.loadRecommendations(user.id, user.token, this.selectedControl());
      },
      error: () => {
        this.formMessage.set('Could not save the recommendation profile.');
        this.formSuccess.set(false);
        this.saving.set(false);
      },
    });
  }

  private loadProfile(): void {
    const user = this.user();
    if (!user) {
      return;
    }

    this.movieService.getProfile(user.id, user.token).subscribe({
      next: ({ profile }) => {
        this.preferredLanguages.set(profile.preferredLanguages || []);
        this.preferredGenres.set(profile.preferredGenres || []);
        this.favoriteTitlesInput.set((profile.favoriteMovieTitles || []).join(', '));
        const focus = typeof profile.recommendationControls?.['focus'] === 'string' ? profile.recommendationControls['focus'] as string : 'balanced';
        this.selectedControl.set(focus);
        this.loadRecommendations(user.id, user.token, focus);
      },
      error: () => {
        this.error.set('Could not load your recommendation profile.');
        this.loading.set(false);
      },
    });
  }

  private loadRecommendations(userId: string, token: string, focus = 'balanced'): void {
    this.loading.set(true);
    this.error.set('');

    this.movieService.getRecommendations(userId, token, focus).subscribe({
      next: ({ recommendations }) => {
        this.recommendations.set(recommendations || []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not generate recommendations for your profile.');
        this.loading.set(false);
      },
    });
  }
}
