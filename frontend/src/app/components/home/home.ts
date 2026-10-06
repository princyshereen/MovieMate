import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="home-hero">
      <div class="hero-content">
        <p class="eyebrow">A little more movie in your day</p>
        <h1>Movie Explorer</h1>
        <p class="hero-description">
          Find films worth talking about, discover new favorites, and keep your next watch close.
        </p>
        <a class="button button-lime" routerLink="/movies">
          Browse movies <span aria-hidden="true">&#8594;</span>
        </a>
      </div>
      <div class="hero-caption" aria-hidden="true">YOUR NEXT FAVORITE IS OUT THERE</div>
    </section>

    <section class="home-intro">
      <div>
        <p class="eyebrow eyebrow-coral">The reel starts here</p>
        <h2>Good stories, one search away.</h2>
      </div>
      <a class="text-link" routerLink="/movies">Explore the movies <span aria-hidden="true">&#8594;</span></a>
    </section>
  `,
})
export class HomeComponent {}