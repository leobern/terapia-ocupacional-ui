import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Placeholder mínimo das telas de destino da splash que pertencem a outras stories:
 * LoginScreen (US-001-1-03), LockScreen (US-001-1-08) e HospitalLinksScreen (US-001-2-02).
 * Cada story substitui a rota correspondente em `app.routing.ts`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-pending-screen',
  template: '<p>{{ screen }}</p>',
})
export class PendingScreenComponent {
  protected readonly screen: string = inject(ActivatedRoute).snapshot.data['screen'] ?? '';
}
