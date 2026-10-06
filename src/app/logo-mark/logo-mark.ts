import { Component } from '@angular/core';

@Component({
  selector: 'app-logo-mark',
  template: `
    <svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="silhouette-mark" x1="8" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop stop-color="#9ecbff" />
          <stop offset="0.48" stop-color="#2f6fe0" />
          <stop offset="1" stop-color="#0a3d91" />
        </linearGradient>
      </defs>
      <path
        fill="#1565c0"
        d="M36 8h8c8.8 0 16 7.2 16 16v32H46V26c0-4.4-3.6-8-8-8h-2V8z"
      />
      <path
        fill="url(#silhouette-mark)"
        d="M18.5 20.5c4.8-7.2 14.2-8.2 18.2-.8 1.6 3 4.2 4.6 4.3 8.2.1 2.6-1.8 4.4-1.7 7.1.2 3.2 2.7 4.8 2.7 8.2V54H24l-1.6-5.2c-1.8-2.2-4.4-4.6-4.4-8.4 0-2.8 1.8-4 1.8-6.6 0-3.4-2.2-5-2.4-8.2-.2-2.2.6-3.8 1.1-5.1z"
      />
      <path fill="#d7e9ff" d="M16 22.5 25 16l7 4.2-3.2 7.6L17.2 30z" />
      <path fill="#7eb6ff" d="M14.5 31.2 25.2 28l2.4 7.4-7.6 5.8-6.8-3.6z" />
      <path fill="#4c8fe8" d="M16.2 42.2 25 37.6l4.2 6.2-5.4 8.2H15.2z" />
      <path
        fill="none"
        stroke="#eef6ff"
        stroke-width="0.8"
        d="M16 22.5 25 16l7 4.2-3.2 7.6L17.2 30zM14.5 31.2 25.2 28l2.4 7.4-7.6 5.8zM16.2 42.2 25 37.6l4.2 6.2"
      />
    </svg>
  `,
})
export class LogoMark {}
