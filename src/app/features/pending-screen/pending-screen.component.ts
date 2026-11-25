import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Placeholder mínimo das telas de destino da splash que pertencem a outras stories:
 * LoginScreen (US-001-1-03), LockScreen (US-001-1-08) e HospitalLinksScreen (US-001-2-02).
 * Cada story substitui a rota correspondente em `app.routing.ts`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-pending-screen',
  template: `
    <p>{{ screen }}</p>
    @if (notice) {
      <p role="alert">{{ notice }}</p>
    }
  `,
})
export class PendingScreenComponent {
  protected readonly screen: string = inject(ActivatedRoute).snapshot.data['screen'] ?? '';
  /** Aviso enviado por quem navegou (ex.: MSG-01 no encerramento de sessão, US-001-1-08). */
  protected readonly notice: string | null =
    (inject(Router).getCurrentNavigation()?.extras.state?.['notice'] as string | undefined) ?? null;
}
