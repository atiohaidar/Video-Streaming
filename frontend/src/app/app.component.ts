import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive],
    template: `
    <div class="app-layout">
      <!-- Header -->
      <header class="header">
        <div class="container">
          <div class="header-content">
            <a routerLink="/" class="logo">
              <span class="logo-icon">▶</span>
              <span class="logo-text">VideoStream</span>
            </a>
            
            <nav class="nav">
              <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-link">
                <span class="nav-icon">📺</span>
                Videos
              </a>
              <a routerLink="/upload" routerLinkActive="active" class="nav-link">
                <span class="nav-icon">⬆️</span>
                Upload
              </a>
            </nav>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="main">
        <div class="container">
          <router-outlet></router-outlet>
        </div>
      </main>

      <!-- Footer -->
      <footer class="footer">
        <div class="container">
          <p>Open-Source Video Streaming Platform • Built with Angular + Rust</p>
        </div>
      </footer>
    </div>
  `,
    styles: [`
    .app-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(10, 10, 15, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--color-border);
      padding: var(--spacing-md) 0;
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      font-size: var(--font-size-xl);
      font-weight: 700;
      color: var(--color-text-primary);
      text-decoration: none;
    }

    .logo-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: var(--color-accent-gradient);
      border-radius: var(--radius-md);
      font-size: var(--font-size-lg);
    }

    .logo-text {
      background: var(--color-accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .nav {
      display: flex;
      gap: var(--spacing-sm);
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-text-secondary);
      text-decoration: none;
      border-radius: var(--radius-md);
      transition: all var(--transition-normal);
    }

    .nav-link:hover {
      color: var(--color-text-primary);
      background: var(--color-bg-tertiary);
    }

    .nav-link.active {
      color: var(--color-accent-primary);
      background: rgba(99, 102, 241, 0.1);
    }

    .nav-icon {
      font-size: var(--font-size-base);
    }

    .main {
      flex: 1;
      padding: var(--spacing-xl) 0;
    }

    .footer {
      padding: var(--spacing-lg) 0;
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      border-top: 1px solid var(--color-border);
    }

    @media (max-width: 600px) {
      .logo-text {
        display: none;
      }
      
      .nav-link span:last-child {
        display: none;
      }
      
      .nav-icon {
        font-size: var(--font-size-lg);
      }
    }
  `],
})
export class AppComponent {
    title = 'VideoStream';
}
