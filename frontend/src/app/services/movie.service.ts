import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export interface Movie {
  id: string;
  title: string;
  poster: string | null;
  overview: string;
  releaseDate: string;
  rating: number | null;
  genre?: string;
  director?: string;
  actors?: string;
  runtime?: string;
  language?: string;
}

interface OMDbMovie {
  imdbID: string;
  Title: string;
  Year: string;
  Poster: string | null;
  Type?: string;
  Genre?: string;
  Director?: string;
  Actors?: string;
  Plot?: string;
  imdbRating?: string | null;
  Runtime?: string;
  Language?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  preferredLanguages?: string[];
  preferredGenres?: string[];
  favoriteMovieTitles?: string[];
  recommendationControls?: Record<string, string | number>;
  onboardingCompleted?: boolean;
}

export interface UserResponse {
  message: string;
  user: UserAccount;
  token?: string;
}

export interface RecommendationProfile {
  preferredLanguages: string[];
  preferredGenres: string[];
  favoriteMovieTitles: string[];
  recommendationControls: Record<string, string | number>;
}

export interface Recommendation extends Movie {
  score?: number;
  explanation?: string;
}

@Injectable({ providedIn: 'root' })
export class MovieService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3001/api/movies';
  private readonly usersUrl = 'http://localhost:3001/api/users';

  getMovies(): Observable<Movie[]> {
    return this.http.get<OMDbMovie[]>(this.apiUrl).pipe(
      map((movies) => movies.map((movie) => this.mapMovie(movie))),
    );
  }

  searchMovies(query: string): Observable<Movie[]> {
    return this.http.get<OMDbMovie[]>(`${this.apiUrl}/search/${encodeURIComponent(query)}`).pipe(
      map((movies) => movies.map((movie) => this.mapMovie(movie))),
    );
  }

  getMovie(id: string): Observable<Movie> {
    return this.http.get<OMDbMovie>(`${this.apiUrl}/${id}`).pipe(
      map((movie) => this.mapMovie(movie)),
    );
  }

  getRegionalCinema(language = 'Tamil'): Observable<Movie[]> {
    return this.http.get<OMDbMovie[]>(`${this.apiUrl}/regional?language=${encodeURIComponent(language)}`).pipe(
      map((movies) => movies.map((movie) => this.mapMovie(movie))),
    );
  }

  savePreferences(userId: string, token: string, payload: Record<string, unknown>): Observable<{ message: string; user: UserAccount }> {
    return this.http.post<{ message: string; user: UserAccount }>(`${this.usersUrl}/preferences/${userId}`, payload, {
      headers: this.authHeaders(token),
    });
  }

  getProfile(userId: string, token: string): Observable<{ user: UserAccount; profile: RecommendationProfile }> {
    return this.http.get<{ user: UserAccount; profile: RecommendationProfile }>(`${this.usersUrl}/profile/${userId}`, {
      headers: this.authHeaders(token),
    });
  }

  getRecommendations(userId: string, token: string, focus = 'balanced'): Observable<{ recommendations: Recommendation[]; profile: RecommendationProfile }> {
    return this.http.get<{ recommendations: Recommendation[]; profile: RecommendationProfile }>(`${this.usersUrl}/recommendations/${userId}?focus=${encodeURIComponent(focus)}`, {
      headers: this.authHeaders(token),
    });
  }

  register(name: string, email: string, password: string): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.usersUrl}/register`, { name, email, password });
  }

  login(email: string, password: string): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.usersUrl}/login`, { email, password });
  }

  addToWatchlist(userId: string, movie: Movie, token: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.usersUrl}/watchlist`,
      { userId, movie },
      { headers: this.authHeaders(token) },
    );
  }

  getWatchlist(userId: string, token: string): Observable<Movie[]> {
    return this.http.get<Movie[]>(`${this.usersUrl}/watchlist/${userId}`, {
      headers: this.authHeaders(token),
    });
  }

  removeFromWatchlist(userId: string, movieId: string, token: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.usersUrl}/watchlist/${userId}/${movieId}`, {
      headers: this.authHeaders(token),
    });
  }

  private authHeaders(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private mapMovie(movie: OMDbMovie): Movie {
    const rating = Number(movie.imdbRating);

    return {
      id: movie.imdbID,
      title: movie.Title,
      poster: movie.Poster,
      overview: movie.Plot || '',
      releaseDate: movie.Year || '',
      rating: Number.isFinite(rating) ? rating : null,
      genre: movie.Genre || '',
      director: movie.Director || '',
      actors: movie.Actors || '',
      runtime: movie.Runtime || '',
      language: movie.Language || '',
    };
  }
}