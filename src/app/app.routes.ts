import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './auth/guards';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Zaloguj się · Silhouette',
    canActivate: [guestGuard],
    loadComponent: () => import('./login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Pulpit · Silhouette',
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'pracownia',
        title: 'Pracownia · Silhouette',
        loadComponent: () => import('./pages/studio/studio').then((m) => m.Studio),
      },
      {
        path: 'ustawienia',
        title: 'Ustawienia · Silhouette',
        loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
      },
    ],
  },
  { path: '**', redirectTo: '/' },
];
