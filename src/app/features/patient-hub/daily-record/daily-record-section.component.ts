import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { IconButtonComponent } from '../../../shared/components/icon-button/icon-button.component';
import { PhIconComponent } from '../../../shared/icons/ph-icon/ph-icon.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { DailyEvolutionSource } from './daily-evolution-source';
import { DailyEvolution, dayKey, registeredAt } from './daily-record.models';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export const EVOLUTION_LOAD_FAILED_HINT = 'Não foi possível carregar a evolução do dia. Tente novamente em instantes.';
export const EVOLUTION_SAVE_FAILED_HINT = 'Não foi possível salvar a evolução. O texto foi mantido; tente novamente.';
export const EVOLUTION_OFFLINE_HINT =
  'Sem conexão: o salvamento no servidor fica pendente até haver conexão. Você pode continuar digitando.';
export const EVOLUTION_EMPTY_TEXT = 'Nenhuma evolução médica registrada hoje.';
export const EVOLUTION_HELP = 'Só médico registra. Texto da IA vem marcado e só salva ao confirmar.';

/**
 * Seção "Registro diário" do Hub (FT-004-7, US-004-7-04), Figma 4717-9855 (desenhado pelo agente). Hoje traz
 * a "Evolução médica" do dia; os Parâmetros assistenciais são outra story e entram como seção independente.
 * Só o médico registra/edita; os demais perfis só consultam. A evolução só muda por salvamento explícito.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent, PhIconComponent],
  selector: 'app-daily-record-section',
  styleUrl: './daily-record-section.component.scss',
  templateUrl: './daily-record-section.component.html',
})
export class DailyRecordSectionComponent {
  readonly patientId = input.required<string>();

  protected readonly state = signal<LoadState>('idle');
  protected readonly saved = signal<DailyEvolution | null>(null);
  protected readonly draft = signal('');
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);
  protected readonly connectivity = inject(ConnectivityService);
  protected readonly isDoctor = inject(ProfessionalProfileReader).read().role === 'doctor';
  protected readonly loadFailedHint = EVOLUTION_LOAD_FAILED_HINT;
  protected readonly saveFailedHint = EVOLUTION_SAVE_FAILED_HINT;
  protected readonly offlineHint = EVOLUTION_OFFLINE_HINT;
  protected readonly emptyText = EVOLUTION_EMPTY_TEXT;
  protected readonly help = EVOLUTION_HELP;
  protected readonly registeredText = computed(() => {
    const s = this.saved();

    return s === null ? '' : `Registrada por ${s.author} · ${registeredAt(s.at)}`;
  });
  protected readonly canSave = computed(
    () => this.isDoctor && !this.saving() && this.connectivity.online() && this.draft().trim() !== '',
  );

  private readonly source = inject(DailyEvolutionSource);
  private readonly profile = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  private readonly isOpen = signal(false);
  private readonly touched = signal(false);
  /** Descarta respostas de uma abertura anterior (fechar e reabrir rápido, ou troca de paciente). */
  private token = 0;
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  constructor() {
    effect(() => {
      const element = this.dialogRef()?.nativeElement;

      if (!element) {
        return;
      }
      if (this.isOpen() && !element.open) {
        element.showModal();
      } else if (!this.isOpen() && element.open) {
        element.close();
      }
    });
  }

  protected open(): void {
    this.isOpen.set(true);
    void this.load();
  }

  protected close(): void {
    this.token++;
    this.isOpen.set(false);
  }

  protected onDialogClick(event: MouseEvent): void {
    // Clique no ::backdrop chega com o próprio <dialog> como alvo.
    if (event.target instanceof HTMLDialogElement) {
      this.close();
    }
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  protected onDraft(event: Event): void {
    this.touched.set(true);
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    const token = this.token;
    const at = this.now();

    this.saving.set(true);
    this.saveFailed.set(false);
    try {
      const saved = await this.source.save({
        at: at.toISOString(),
        author: this.profile.read().name,
        day: dayKey(at),
        origin: 'manual',
        patientId: this.patientId(),
        text: this.draft().trim(),
      });

      if (token === this.token) {
        this.saved.set(saved);
        this.draft.set(saved.text);
        this.touched.set(false);
      }
    } catch {
      if (token === this.token) {
        this.saveFailed.set(true);
      }
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    const token = ++this.token;

    this.state.set('loading');
    this.saved.set(null);
    this.draft.set('');
    this.touched.set(false);
    this.saveFailed.set(false);
    try {
      const current = await this.source.load(this.patientId(), dayKey(this.now()));

      if (token !== this.token) {
        return;
      }
      this.saved.set(current);
      // Offline ou digitação já iniciada: nunca sobrescreve o que o médico escreveu.
      if (!this.touched()) {
        this.draft.set(current?.text ?? '');
      }
      this.state.set('ready');
    } catch {
      if (token === this.token) {
        // Falha na leitura não bloqueia o registro manual (Princípio VI).
        this.state.set('error');
      }
    }
  }
}
