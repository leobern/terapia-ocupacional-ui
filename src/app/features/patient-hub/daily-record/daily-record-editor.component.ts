import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';

import { FieldCardComponent } from '../../../shared/components/field-card/field-card.component';
import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import {
  AssistantEditorController,
  type EditorAction,
} from '../../../shared/services/assistant-editor-controller.service';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { PrescriptionGuidanceComponent } from '../prescription/prescription-guidance.component';
import { DailyEvolutionComponent } from './daily-evolution.component';
import {
  customParameterId,
  INITIAL_PARAMETERS,
  INVALID_VALUE_HINT,
  NewParameterEntry,
  NOTHING_TO_SAVE_HINT,
  parseParameterValue,
} from './daily-record.models';
import { DailyRecordWriter } from './daily-record-writer';

export const DAILY_OFFLINE_HINT = 'Sem conexão: salvar fica indisponível. Os valores digitados serão mantidos.';
export const DAILY_SAVE_FAILED_HINT =
  'Não foi possível salvar o registro. Os valores digitados foram mantidos; tente novamente.';
export const DAILY_NAME_REQUIRED_HINT = 'Informe o nome do resultado para salvar.';

/** Resultado laboratorial: parâmetro fora do catálogo, com nome e unidade informados no card. */
interface LabResult {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
}

/**
 * Evolução do paciente no painel lateral conversacional (Thiago, 2026-11-25). Os atalhos "Inserir parâmetros
 * assistenciais" e "Inserir resultados laboratoriais" abrem os cards de valores; "Salvar" grava só o que foi preenchido.
 * A evolução médica em texto e as orientações da prescrição seguem abaixo, nos componentes de sempre.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DailyEvolutionComponent, FieldCardComponent, PrescriptionGuidanceComponent],
  selector: 'app-daily-record-editor',
  styleUrl: './daily-record-editor.component.scss',
  templateUrl: './daily-record-editor.component.html',
})
export class DailyRecordEditorComponent {
  readonly patientId = input.required<string>();
  /** Chamado depois de salvar os parâmetros. */
  readonly saved = input<() => void>(() => undefined);

  protected readonly parameters = INITIAL_PARAMETERS;
  protected readonly showParameters = signal(false);
  protected readonly labs = signal<readonly LabResult[]>([]);
  protected readonly values = signal<Readonly<Record<string, string>>>({});
  protected readonly errors = signal<Readonly<Record<string, string>>>({});
  protected readonly hint = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly filled = computed(() => Object.values(this.values()).some(v => v.trim() !== ''));
  /** Há algo a salvar: algum valor preenchido ou a evolução médica escrita. */
  protected readonly dirty = computed(() => this.filled() || this.evolution()?.canSave() === true);

  private readonly evolution = viewChild(DailyEvolutionComponent);
  private readonly writer = inject(DailyRecordWriter);
  private readonly assistant = inject(AiAssistantService);
  private readonly editor = inject(AssistantEditorController);
  private readonly connectivity = inject(ConnectivityService);
  private readonly professional = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  private labSequence = 0;

  constructor() {
    effect(onCleanup => {
      const actions = computed<readonly EditorAction[]>(() => [
        ...(this.showParameters() ? [] : [{ id: 'parameters', label: 'Inserir parâmetros assistenciais' }]),
        { id: 'lab', label: 'Inserir resultados laboratoriais' },
        ...(this.dirty() ? [{ id: 'save', label: 'Salvar' }] : []),
      ]);

      onCleanup(
        this.editor.attach({
          actions,
          placeholder: 'Escreva a sua mensagem',
          run: (action): void => {
            if (action === 'parameters') {
              this.showParameters.set(true);
            } else if (action === 'lab') {
              this.labs.update(list => [...list, { id: `lab-${++this.labSequence}`, label: '', unit: '' }]);
            } else {
              void this.save();
            }
          },
        }),
      );
    });
  }

  protected valueOf(id: string): string {
    return this.values()[id] ?? '';
  }

  protected edit(id: string, value: string): void {
    this.values.update(v => ({ ...v, [id]: value }));
    this.errors.update(e => ({ ...e, [id]: '' }));
    this.hint.set(null);
  }

  protected editLab(id: string, field: 'label' | 'unit', value: string): void {
    this.labs.update(list => list.map(l => (l.id === id ? { ...l, [field]: value } : l)));
    this.errors.update(e => ({ ...e, [id]: '' }));
  }

  /** Grava os valores preenchidos e a evolução médica; fecha o painel só quando tudo foi gravado. */
  protected async save(): Promise<void> {
    if (this.busy()) {
      return;
    }
    const entries = this.entriesToSave();

    if (entries === null) {
      return;
    }
    const evolution = this.evolution();
    const writesEvolution = evolution?.canSave() === true;

    if (entries.length === 0 && !writesEvolution) {
      this.hint.set(NOTHING_TO_SAVE_HINT);

      return;
    }
    if (!this.connectivity.online()) {
      this.hint.set(DAILY_OFFLINE_HINT);

      return;
    }
    this.busy.set(true);
    try {
      if (entries.length > 0) {
        await this.writer.record(this.patientId(), entries);
      }
      if (writesEvolution && !(await (evolution as DailyEvolutionComponent).save())) {
        this.hint.set(DAILY_SAVE_FAILED_HINT);

        return;
      }
      this.saved()();
      this.assistant.closePanel();
    } catch {
      this.hint.set(DAILY_SAVE_FAILED_HINT);
    } finally {
      this.busy.set(false);
    }
  }

  /** Lançamentos dos cards preenchidos; `null` se algum valor é inválido (os erros ficam nos cards). */
  private entriesToSave(): NewParameterEntry[] | null {
    const meta = { at: this.now().toISOString(), author: this.professional.read().name };
    const errors: Record<string, string> = {};
    const entries: NewParameterEntry[] = [];

    for (const parameter of this.parameters) {
      this.collect(parameter.id, null, errors, entries, meta);
    }
    for (const lab of this.labs()) {
      this.collect(lab.id, lab, errors, entries, meta);
    }
    this.errors.set(errors);

    return Object.keys(errors).length > 0 ? null : entries;
  }

  private collect(
    id: string,
    lab: LabResult | null,
    errors: Record<string, string>,
    entries: NewParameterEntry[],
    meta: { readonly at: string; readonly author: string },
  ): void {
    const text = this.valueOf(id).trim();

    if (text === '') {
      return;
    }
    const value = parseParameterValue(text);

    if (lab && lab.label.trim() === '') {
      errors[id] = DAILY_NAME_REQUIRED_HINT;
    } else if (value === null) {
      errors[id] = INVALID_VALUE_HINT;
    } else if (lab) {
      const label = lab.label.trim();

      entries.push({
        ...meta,
        parameterId: customParameterId(label),
        parameterLabel: label,
        unit: lab.unit.trim(),
        value,
      });
    } else {
      entries.push({ ...meta, parameterId: id, value });
    }
  }
}
