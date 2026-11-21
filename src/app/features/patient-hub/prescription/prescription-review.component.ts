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

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { IconButtonComponent } from '../../../shared/components/icon-button/icon-button.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { DailyAdequacy } from '../../daily-evolution/adequacy/adequacy.models';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { dayKey, registeredAt } from '../daily-record/daily-record.models';
import { PlanSource } from '../plan/plan-source';
import { TargetsEditorComponent } from '../plan/targets-editor.component';
import { formatNumber, NutritionTargets } from '../plan/plan-targets';
import { ActivePrescription, formatOptional, PrescriptionReview } from './prescription.models';
import { PrescriptionSource } from './prescription-source';

export const REVIEW_LOAD_FAILED_HINT = 'Não foi possível carregar a prescrição. Tente novamente em instantes.';
export const REVIEW_SAVE_FAILED_HINT = 'Não foi possível registrar a revisão. Nada foi alterado; tente novamente.';
export const REVIEW_OFFLINE_HINT = 'Conexão necessária para manter a prescrição.';
export const TARGETS_OFFLINE_HINT = 'Conexão necessária para ajustar a meta.';
export const TARGETS_SAVE_FAILED_HINT = 'Não foi possível salvar a meta. A meta anterior foi mantida; tente novamente.';
export const TARGETS_NOTHING_HINT = 'Nada a salvar: altere o peso de referência ou os fatores da meta.';
export const NO_PRESCRIPTION_TEXT = 'Nenhuma prescrição ativa para este paciente.';
export const ADEQUACY_UNAVAILABLE_TEXT = 'Adequação indisponível.';
export const TARGETS_UNAVAILABLE_TEXT = 'Meta indisponível: defina a meta calórica e proteica no Plano de intervenção.';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Revisão diária da prescrição (FT-004-8, US-004-8-01; Figma 4718-10198, desenhado pelo agente): resumo
 * (% de adequação, meta e prescrição ativa) e a decisão "Manter prescrição". Exclusivo do médico. Os campos
 * de edição do protótipo (volume, velocidade, meta, via, áudio) pertencem às US2–US4 e ficam fora.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent, TargetsEditorComponent],
  selector: 'app-prescription-review',
  styleUrl: './prescription-review.component.scss',
  templateUrl: './prescription-review.component.html',
})
export class PrescriptionReviewComponent {
  readonly open = input(false);
  readonly patientId = input.required<string>();
  /** % de adequação já calculada pela Evolução Diária (FT-004-7); nunca recalculada aqui. */
  readonly adequacy = input<DailyAdequacy | null>(null);
  readonly closed = output();
  /** Meta gravada aqui: o Hub recalcula a % de adequação (cálculo único). */
  readonly targetsSaved = output();

  protected readonly state = signal<LoadState>('idle');
  protected readonly prescription = signal<ActivePrescription | null>(null);
  protected readonly targets = signal<NutritionTargets | null>(null);
  protected readonly review = signal<PrescriptionReview | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);
  protected readonly adjustingTargets = signal(false);
  protected readonly savingTargets = signal(false);
  protected readonly targetsHint = signal<string | null>(null);
  protected readonly targetsOfflineHint = TARGETS_OFFLINE_HINT;
  /** Só o médico abre e decide; para os demais a ação não existe. */
  protected readonly isDoctor = inject(ProfessionalProfileReader).read().role === 'doctor';
  protected readonly online = inject(ConnectivityService).online;
  protected readonly loadFailedHint = REVIEW_LOAD_FAILED_HINT;
  protected readonly saveFailedHint = REVIEW_SAVE_FAILED_HINT;
  protected readonly offlineHint = REVIEW_OFFLINE_HINT;
  protected readonly noPrescriptionText = NO_PRESCRIPTION_TEXT;
  protected readonly targetsUnavailableText = TARGETS_UNAVAILABLE_TEXT;
  protected readonly formatOptional = formatOptional;
  protected readonly formatNumber = formatNumber;

  protected readonly adequacyText = computed(() => {
    const a = this.adequacy();

    return a?.status === 'available'
      ? `Hoje: ${a.calories.percent}% da meta calórica e ${a.protein.percent}% da proteica. Mantenha ou ajuste a prescrição.`
      : ADEQUACY_UNAVAILABLE_TEXT;
  });
  protected readonly prescribedText = computed(() => {
    const p = this.prescription();

    return p === null ? '' : `${p.author} · ${p.role} · ${registeredAt(p.at)}`;
  });
  protected readonly reviewedText = computed(() => {
    const r = this.review();

    return r === null ? '' : `Revisada hoje por ${r.author} · ${registeredAt(r.at)}`;
  });
  protected readonly canKeep = computed(
    () => this.state() === 'ready' && !this.saving() && this.online() && this.review() === null,
  );

  private readonly targetsEditor = viewChild(TargetsEditorComponent);
  private readonly source = inject(PrescriptionSource);
  private readonly plan = inject(PlanSource);
  private readonly profile = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  /** Descarta respostas de uma abertura anterior (fechar e reabrir rápido, ou troca de paciente). */
  private token = 0;
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
    effect(() => {
      if (this.open() && this.isDoctor) {
        const id = this.patientId();

        untracked(() => void this.load(id));
      } else {
        untracked(() => this.token++);
      }
    });
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

  /** Confirma "manter": só registra a revisão do dia; a prescrição não é tocada. */
  protected async keep(): Promise<void> {
    if (!this.isDoctor || !this.canKeep()) {
      return;
    }
    const token = this.token;
    const at = this.now();

    this.saving.set(true);
    this.saveFailed.set(false);
    try {
      const saved = await this.source.keep({
        at: at.toISOString(),
        author: this.profile.read().name,
        day: dayKey(at),
        patientId: this.patientId(),
      });

      if (token === this.token) {
        this.review.set(saved);
      }
    } catch {
      if (token === this.token) {
        this.saveFailed.set(true);
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected startTargets(): void {
    if (this.isDoctor && this.online()) {
      this.targetsHint.set(null);
      this.adjustingTargets.set(true);
    }
  }

  protected cancelTargets(): void {
    this.adjustingTargets.set(false);
    this.targetsHint.set(null);
  }

  /**
   * Grava a meta pelo mesmo mecanismo do Plano de Intervenção (autor e data/hora na trilha da FT-004-6).
   * Independente da prescrição: não toca nela nem na decisão "manter".
   */
  protected async saveTargets(): Promise<void> {
    const editor = this.targetsEditor();

    if (!this.isDoctor || editor === undefined || this.savingTargets()) {
      return;
    }
    if (!this.online()) {
      this.targetsHint.set(TARGETS_OFFLINE_HINT);

      return;
    }
    const pending = editor.pending();

    if (pending.error !== null) {
      this.targetsHint.set(pending.error);

      return;
    }
    if (pending.reference === null && pending.targets === null) {
      this.targetsHint.set(TARGETS_NOTHING_HINT);

      return;
    }
    const token = this.token;
    const at = this.now();

    this.savingTargets.set(true);
    this.targetsHint.set(null);
    try {
      await editor.commit(
        { at: at.toISOString(), author: this.profile.read().name, patientId: this.patientId() },
        pending,
      );
    } catch {
      if (token === this.token) {
        this.targetsHint.set(TARGETS_SAVE_FAILED_HINT);
      }
    } finally {
      this.savingTargets.set(false);
    }
  }

  /** A meta vigente passou a ser a nova: relê, fecha a edição e avisa o Hub. */
  protected async onTargetsSaved(): Promise<void> {
    const token = this.token;

    this.adjustingTargets.set(false);
    this.targetsSaved.emit();
    try {
      const targets = await this.plan.loadTargets(this.patientId());

      if (token === this.token) {
        this.targets.set(targets);
      }
    } catch {
      // Mantém a meta já exibida; o Hub recalcula a adequação com a meta gravada.
    }
  }

  private async load(patientId: string): Promise<void> {
    const token = ++this.token;

    this.state.set('loading');
    this.prescription.set(null);
    this.targets.set(null);
    this.review.set(null);
    this.saveFailed.set(false);
    this.adjustingTargets.set(false);
    this.targetsHint.set(null);
    try {
      const [prescription, targets, review] = await Promise.all([
        this.source.loadActive(patientId),
        this.plan.loadTargets(patientId),
        this.source.loadReview(patientId, dayKey(this.now())),
      ]);

      if (token !== this.token) {
        return;
      }
      this.prescription.set(prescription);
      this.targets.set(targets);
      this.review.set(review);
      this.state.set('ready');
    } catch {
      if (token === this.token) {
        this.state.set('error');
      }
    }
  }
}
