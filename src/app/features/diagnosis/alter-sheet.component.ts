import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { ButtonComponent } from '../../shared/components/button/button.component';
import {
  GLIM_CRITERIA,
  GLIM_STATE_LABELS,
  GlimCriterionId,
  GlimCriterionState,
  GlimResult,
  GlimSeverity,
} from './diagnosis.models';

type AlterOutcome = GlimResult['outcome'];

export const OUTCOME_OPTIONS: readonly { readonly id: AlterOutcome; readonly label: string }[] = [
  { id: 'confirmed', label: 'Desnutrição confirmada' },
  { id: 'excluded', label: 'Desnutrição excluída' },
  { id: 'indeterminate', label: 'Indeterminado' },
];

export const STAGING_OPTIONS: readonly { readonly id: GlimSeverity; readonly label: string }[] = [
  { id: 'moderate', label: 'Moderada' },
  { id: 'severe', label: 'Grave' },
];

const NO_CRITERIA: GlimResult['criteria'] = {
  inflammation: 'not-evaluated',
  'low-bmi': 'not-evaluated',
  'low-muscle-mass': 'not-evaluated',
  'reduced-intake': 'not-evaluated',
  'weight-loss': 'not-evaluated',
};

export const STAGING_HINT = 'O estadiamento só se aplica ao resultado "Desnutrição confirmada"; foi limpo.';

/**
 * Sheet de alteração manual do resultado do GLIM (US-004-5-02). Sem desenho no Figma: segue o padrão do
 * sheet do plano (tela 14) com componentes v2, desenhado pelo agente. Só emite `saved` ao salvar;
 * cancelar não altera nada.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  selector: 'app-diagnosis-alter-sheet',
  styleUrl: './alter-sheet.component.scss',
  templateUrl: './alter-sheet.component.html',
})
export class AlterSheetComponent {
  readonly open = input.required<boolean>();
  readonly result = input.required<GlimResult>();
  readonly saved = output<GlimResult>();
  readonly cancelled = output();

  protected readonly criteria = GLIM_CRITERIA;
  protected readonly states = Object.entries(GLIM_STATE_LABELS) as [GlimCriterionState, string][];
  protected readonly outcomes = OUTCOME_OPTIONS;
  protected readonly stagings = STAGING_OPTIONS;
  protected readonly draftCriteria = signal<GlimResult['criteria']>(NO_CRITERIA);
  protected readonly draftOutcome = signal<AlterOutcome>('indeterminate');
  protected readonly draftStaging = signal<GlimSeverity | null>(null);
  protected readonly hint = signal<string | null>(null);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialogEl');

  constructor() {
    effect(() => {
      const element = this.dialogRef().nativeElement;

      if (this.open() && !element.open) {
        const current = this.result();

        this.draftCriteria.set(current.criteria);
        this.draftOutcome.set(current.outcome);
        this.draftStaging.set(current.staging);
        this.hint.set(null);
        element.showModal();
      } else if (!this.open() && element.open) {
        element.close();
      }
    });
  }

  protected stateOf(id: GlimCriterionId): GlimCriterionState {
    return this.draftCriteria()[id];
  }

  protected setState(id: GlimCriterionId, value: string): void {
    this.draftCriteria.update(c => ({ ...c, [id]: value as GlimCriterionState }));
  }

  protected setOutcome(value: string): void {
    this.draftOutcome.set(value as AlterOutcome);
    if (value !== 'confirmed' && this.draftStaging() !== null) {
      this.draftStaging.set(null);
      this.hint.set(STAGING_HINT);
    }
  }

  protected setStaging(value: string): void {
    this.draftStaging.set(value === '' ? null : (value as GlimSeverity));
  }

  protected save(): void {
    this.saved.emit({ criteria: this.draftCriteria(), outcome: this.draftOutcome(), staging: this.draftStaging() });
  }

  protected onClick(event: MouseEvent): void {
    if (event.target instanceof HTMLDialogElement) {
      this.cancelled.emit();
    }
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.cancelled.emit();
  }
}
