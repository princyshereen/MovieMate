import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar';

@Component({
  selector: 'app-root',
  imports: [NavbarComponent, RouterOutlet],
  template: `
    <app-navbar />
    <main>
    <router-outlet />
    </main>
  `,
})
export class App {}
