import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { PhIconComponent } from '../../shared/icons/ph-icon/ph-icon.component';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { formatShortYearDate } from '../../shared/utils/br-date';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import {
  CLOSURE_FAILED_HINT,
  CLOSURE_REASONS,
  ClosureReason,
  FollowUpClosure,
  OFFLINE_CLOSURE_HINT,
  REASON_REQUIRED_HINT,
  reasonLabel,
  toIsoDate,
  validateEffectiveDate,
} from './follow-up-closure.models';
import { FollowUpClosureWriter } from './follow-up-closure-source';

/** Paciente em contexto no modal: o mesmo resumo vem da lista (swipe) e do Hub (FR-001a). */
export interface ClosurePatient {
  readonly id: string;
  readonly name: string;
  readonly ward: string;
  readonly bed: string;
}

/**
 * Encerrar acompanhamento (FT-004-9, US-004-9-01; Figma 4719-10550, desenhado pelo agente): bottom-sheet no
 * mobile e diálogo centralizado no desktop. Componente ÚNICO: o swipe da lista e o Hub abrem este mesmo modal
 * (FR-001a), sem fluxo paralelo.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent, PhIconComponent],
  selector: 'app-follow-up-closure-sheet',
  styleUrl: './follow-up-closure-sheet.component.scss',
  templateUrl: './follow-up-closure-sheet.component.html',
})
export class FollowUpClosureSheetComponent {
  readonly open = input(false);
  readonly patient = input.required<ClosurePatient>();
  readonly closed = output();
  /** Encerramento gravado: quem abriu o modal atualiza a tela. */
  readonly saved = output<FollowUpClosure>();

  protected readonly reasons = CLOSURE_REASONS;
  protected readonly online = inject(ConnectivityService).online;
  protected readonly offlineHint = OFFLINE_CLOSURE_HINT;
  protected readonly failedHint = CLOSURE_FAILED_HINT;
  protected readonly reason = signal<ClosureReason | null>(null);
  protected readonly date = signal('');
  protected readonly maxDate = computed(() => toIsoDate(this.now()));
  protected readonly reasonError = signal<string | null>(null);
  protected readonly dateError = signal<string | null>(null);
  /** Segunda etapa: confirmação explícita antes de aplicar (FR-004). */
  protected readonly confirming = signal(false);
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  protected readonly summary = computed(() => {
    const reason = this.reason();

    return reason === null ? '' : `${reasonLabel(reason)} em ${formatShortYearDate(this.date())}`;
  });

  private readonly writer = inject(FollowUpClosureWriter);
  private readonly professional = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  constructor() {
    effect(() => {
      const element = this.dialogRef()?.nativeElement;
      const isOpen = this.open();

      if (!element) {
        return;
      }
      if (isOpen && !element.open) {
        element.showModal();
      } else if (!isOpen && element.open) {
        element.close();
      }
    });
    // Cada abertura começa limpa: motivo em branco e data de hoje (FR-003).
    effect(() => {
      if (this.open()) {
        untracked(() => this.reset());
      }
    });
  }

  protected selectReason(reason: ClosureReason): void {
    this.reason.set(reason);
    this.reasonError.set(null);
    this.confirming.set(false);
  }

  protected setDate(value: string): void {
    this.date.set(value);
    this.dateError.set(null);
    this.confirming.set(false);
  }

  /** 1º clique: valida e pede a confirmação explícita; nada é gravado ainda. */
  protected review(): void {
    this.failed.set(false);
    this.reasonError.set(this.reason() === null ? REASON_REQUIRED_HINT : null);
    this.dateError.set(validateEffectiveDate(this.date(), this.now()));
    this.confirming.set(this.reason() !== null && this.dateError() === null);
  }

  protected backToEdit(): void {
    this.confirming.set(false);
  }

  protected async confirm(): Promise<void> {
    const reason = this.reason();

    if (reason === null || this.saving() || !this.online() || validateEffectiveDate(this.date(), this.now())) {
      return;
    }
    this.saving.set(true);
    this.failed.set(false);
    try {
      const closure = await this.writer.close({
        at: this.now().toISOString(),
        author: this.professional.read().name,
        effectiveDate: this.date(),
        patientId: this.patient().id,
        reason,
      });

      this.saved.emit(closure);
      this.closed.emit();
    } catch {
      this.failed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  protected close(): void {
    this.closed.emit();
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

  private reset(): void {
    this.reason.set(null);
    this.date.set(toIsoDate(this.now()));
    this.reasonError.set(null);
    this.dateError.set(null);
    this.confirming.set(false);
    this.saving.set(false);
    this.failed.set(false);
  }
}
