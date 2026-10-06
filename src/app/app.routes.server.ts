import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server,
    headers: {
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie',
    },
  },
];
