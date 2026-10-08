import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from './services/auth.service';
import { HomeComponent } from './components/home/home';
import { LoginComponent } from './components/login/login';
import { MovieDetailsComponent } from './components/movie-details/movie-details';
import { MoviesComponent } from './components/movies/movies';
import { RegisterComponent } from './components/register/register';
import { RecommendationsComponent } from './components/recommendations/recommendations';
import { WatchlistComponent } from './components/watchlist/watchlist';

const requireLogin: CanActivateFn = () => {
	const router = inject(Router);
	return inject(AuthService).isLoggedIn() || router.createUrlTree(['/login']);
};

export const routes: Routes = [
	{ path: '', component: HomeComponent, title: 'Home | Movie Explorer' },
	{ path: 'login', component: LoginComponent, title: 'Login | Movie Explorer' },
	{ path: 'register', component: RegisterComponent, title: 'Register | Movie Explorer' },
	{ path: 'watchlist', component: WatchlistComponent, canActivate: [requireLogin], title: 'Watchlist | Movie Explorer' },
	{ path: 'recommendations', component: RecommendationsComponent, canActivate: [requireLogin], title: 'Recommendations | Movie Explorer' },
	{ path: 'movies', component: MoviesComponent, title: 'Movies | Movie Explorer' },
	{ path: 'movies/:id', component: MovieDetailsComponent, title: 'Movie Details | Movie Explorer' },
	{ path: '**', redirectTo: '' },
];
