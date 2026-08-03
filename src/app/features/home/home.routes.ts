import { Routes } from '@angular/router';

/**
 * Rotas da feature Home.
 *
 * STUB deliberado. `app.routing.ts` já apontava para `HOME_ROUTES` antes desta
 * feature existir — import quebrado que derrubava `ng build` e `ng test` inteiros
 * (achado do code review do PR #1, Princípio IX). O stub existe para tornar a
 * referência verdadeira; a tela real entra por uma entry `/speckit-specify`
 * própria, com nó Figma de origem (Princípio VIII).
 */
export const HOME_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./home.component').then(m => m.HomeComponent),
  },
];
