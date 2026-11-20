import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import { PhIconComponent } from '../../../shared/icons/ph-icon/ph-icon.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { PriorStaysSource, PriorStaysSynthesizer } from '../patient-hub-source';

type SynthesisState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Caixa expansível "Internações anteriores" (FT-004-2, US-004-2-03). Só existe quando há internação anterior
 * do paciente no mesmo hospital; abre recolhida; a síntese por IA é consultada ao expandir e é somente leitura.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhIconComponent],
  selector: 'app-prior-stays-box',
  styleUrl: './prior-stays-box.component.scss',
  templateUrl: './prior-stays-box.component.html',
})
export class PriorStaysBoxComponent {
  readonly patientId = input.required<string>();
  readonly hospitalId = input.required<string>();

  protected readonly connectivity = inject(ConnectivityService);
  protected readonly visible = signal(false);
  protected readonly expanded = signal(false);
  protected readonly state = signal<SynthesisState>('idle');
  protected readonly summary = signal('');

  private readonly stays = inject(PriorStaysSource);
  private readonly synthesizer = inject(PriorStaysSynthesizer);
  /** Descarta respostas de uma consulta anterior (troca de paciente/hospital ou nova tentativa). */
  private token = 0;

  constructor() {
    effect(() => {
      void this.check(this.patientId(), this.hospitalId());
    });
  }

  protected toggle(): void {
    const open = !this.expanded();

    this.expanded.set(open);
    if (open && this.state() !== 'ready') {
      void this.load();
    }
  }

  protected retry(): void {
    void this.load();
  }

  private async check(patientId: string, hospitalId: string): Promise<void> {
    const token = ++this.token;

    this.visible.set(false);
    this.expanded.set(false);
    this.state.set('idle');
    this.summary.set('');
    try {
      const has = await this.stays.hasPriorStays(patientId, hospitalId);

      if (token === this.token) {
        this.visible.set(has);
      }
    } catch {
      // falha na consulta: a caixa simplesmente não aparece
    }
  }

  private async load(): Promise<void> {
    if (!this.connectivity.online()) {
      return;
    }
    const token = ++this.token;

    this.state.set('loading');
    try {
      const text = await this.synthesizer.synthesize(this.patientId(), this.hospitalId());

      if (token === this.token) {
        this.summary.set(text);
        this.state.set('ready');
      }
    } catch {
      if (token === this.token) {
        this.state.set('error');
      }
    }
  }
}
