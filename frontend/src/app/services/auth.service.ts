import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly usersUrl = 'http://localhost:3001/api/users';
  private readonly storageKey = 'movieExplorerUser';
  private readonly userState = signal<AuthenticatedUser | null>(this.readStoredUser());

  readonly user = this.userState.asReadonly();
  readonly isLoggedIn = computed(() => this.userState() !== null);

  currentUser(): AuthenticatedUser | null {
    return this.userState();
  }

  setSession(user: { id: string; name: string; email: string }, token: string): void {
    const authenticatedUser = { ...user, token };
    localStorage.setItem(this.storageKey, JSON.stringify(authenticatedUser));
    this.userState.set(authenticatedUser);
  }

  logout(): void {
    const token = this.userState()?.token;
    if (token) {
      this.http.post(`${this.usersUrl}/logout`, {}, {
        headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
      }).subscribe({ error: () => {} });
    }

    localStorage.removeItem(this.storageKey);
    this.userState.set(null);
  }

  private readStoredUser(): AuthenticatedUser | null {
    const storedUser = localStorage.getItem(this.storageKey);
    if (!storedUser) {
      return null;
    }

    try {
      const user = JSON.parse(storedUser) as Partial<AuthenticatedUser>;
      if (
        typeof user.id === 'string' &&
        typeof user.name === 'string' &&
        typeof user.email === 'string' &&
        typeof user.token === 'string' &&
        user.token.length > 0
      ) {
        return user as AuthenticatedUser;
      }
    } catch {
      localStorage.removeItem(this.storageKey);
      return null;
    }

    localStorage.removeItem(this.storageKey);
    return null;
  }
}