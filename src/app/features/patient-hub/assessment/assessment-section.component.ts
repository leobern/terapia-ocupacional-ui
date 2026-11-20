import {
  ChangeDetectionStrategy,
  Component,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { IconButtonComponent } from '../../../shared/components/icon-button/icon-button.component';
import { PhIconComponent } from '../../../shared/icons/ph-icon/ph-icon.component';
import {
  ASSESSMENT_SECTIONS,
  AssessmentFieldDefinition,
  AssessmentFieldId,
  NutritionFunctionalAssessment,
} from './assessment.models';
import { AssessmentSource } from './assessment-source';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export const LOAD_FAILED_HINT = 'Não foi possível carregar a avaliação anterior. Os campos abrem vazios.';

/** Formata ISO como dd/MM (ano omitido, como no Figma 4682-9078). */
function shortDate(iso: string): string {
  const d = new Date(iso);

  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Seção "Avaliação Nutricional e Funcional" do Hub (FT-004-4, US-004-4-01): recolhida por padrão; ao
 * acionar, abre o formulário em duas sub-seções (bottom-sheet no mobile, diálogo centralizado no desktop).
 * Digitação, IA e salvar ficam para outras stories.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent, PhIconComponent],
  selector: 'app-assessment-section',
  styleUrl: './assessment-section.component.scss',
  templateUrl: './assessment-section.component.html',
})
export class AssessmentSectionComponent {
  readonly patientId = input.required<string>();
  /** Avaliação concluída pelo profissional: o Hub abre o Diagnóstico (FT-004-5) se houver triagem positiva. */
  readonly concluded = output();

  protected readonly sections = ASSESSMENT_SECTIONS;
  protected readonly assessment = signal<NutritionFunctionalAssessment | null>(null);
  protected readonly state = signal<LoadState>('idle');
  protected readonly loadFailedHint = LOAD_FAILED_HINT;

  private readonly source = inject(AssessmentSource);
  private readonly isOpen = signal(false);
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

  protected conclude(): void {
    this.close();
    this.concluded.emit();
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

  protected valueOf(id: AssessmentFieldId): string {
    return this.assessment()?.values[id] ?? '';
  }

  protected helpOf(field: AssessmentFieldDefinition): string {
    const previous = this.assessment()?.previous[field.id];

    if (previous === undefined) {
      return field.help;
    }
    const unit = field.unit === undefined ? '' : ` ${field.unit}`;

    return `Anterior: ${previous.value}${unit} em ${shortDate(previous.at)}.`;
  }

  private async load(): Promise<void> {
    const token = ++this.token;

    this.assessment.set(null);
    this.state.set('loading');
    try {
      const latest = await this.source.loadLatest(this.patientId());

      if (token === this.token) {
        this.assessment.set(latest);
        this.state.set('ready');
      }
    } catch {
      if (token === this.token) {
        this.state.set('error');
      }
    }
  }
}
