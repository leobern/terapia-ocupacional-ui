import { Routes } from '@angular/router';

import { environment } from '../environments/environment';

/**
 * Galeria de desenvolvimento — NUNCA em produção (Princípio IX).
 *
 * O ternário fica fora do array de rotas de propósito: `environment.production` é
 * substituído por `true` literal no build de produção (`fileReplacements` do
 * angular.json), então o esbuild elimina o ramo inteiro — o `import()` some junto e
 * nenhum chunk da galeria é emitido. Um guard de runtime dentro do array manteria o
 * import vivo e o chunk no bundle.
 */
const devRoutes: Routes = environment.production
  ? []
  : [
      {
        path: 'dev/design-system',
        loadComponent: () =>
          import('./dev/design-system-gallery/design-system-gallery.component').then(
            m => m.DesignSystemGalleryComponent,
          ),
      },
    ];

export const routes: Routes = [
  ...devRoutes,
  {
    path: 'home',
    loadChildren: () => import('./features/home/home.routes').then(m => m.HOME_ROUTES),
  },
  { path: '', pathMatch: 'full', redirectTo: 'home' },
];
