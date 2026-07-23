import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dev/design-system',
    loadComponent: () =>
      import('./dev/design-system-gallery/design-system-gallery.component').then(m => m.DesignSystemGalleryComponent),
  },
];
