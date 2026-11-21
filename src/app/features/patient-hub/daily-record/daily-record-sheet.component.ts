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
import { InputChatAudioError, InputChatComponent } from '../../../shared/components/input-chat/input-chat.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { PrescriptionGuidanceComponent } from '../prescription/prescription-guidance.component';
import { DailyEvolutionComponent } from './daily-evolution.component';
import {
  CUSTOM_PARAMETER_PREFIX,
  customParameterId,
  findParameter,
  formatEntryTime,
  formatParameterValue,
  INITIAL_PARAMETERS,
  INVALID_VALUE_HINT,
  isSameDay,
  NewParameterEntry,
  NOTHING_TO_SAVE_HINT,
  ParameterDefinition,
  ParameterEntry,
  parseParameterValue,
  SuggestedParameter,
} from './daily-record.models';
import { DailyRecordSource } from './daily-record-source';
import { DailyRecordWriter } from './daily-record-writer';
import { ParameterAiStructurer } from './parameter-ai-structurer';

export const SAVE_FAILED_HINT =
  'Não foi possível salvar o registro. Os valores digitados foram mantidos; tente novamente.';
export const OFFLINE_SAVE_HINT =
  'Sem conexão: salvar fica indisponível. Você pode continuar preenchendo; os valores serão mantidos.';
export const LOAD_FAILED_HINT = 'Não foi possível carregar os lançamentos de hoje. Você ainda pode registrar valores.';
export const SAVED_HINT = 'Registro salvo.';
export const EMPTY_HISTORY_TEXT = 'Nenhum lançamento hoje.';
export const AI_SUGGESTED_NOTE = 'Sugerido pela IA, confirme antes de salvar.';
export const AI_PROCESSING_HINT = 'Processando o áudio…';
export const AI_UNAVAILABLE_HINT = 'Registro por IA indisponível sem conexão. Preencha os valores manualmente.';
export const AI_FAILED_HINT = 'Não foi possível estruturar o áudio por IA. Preencha manualmente ou tente de novo.';
export const AI_EMPTY_HINT = 'A IA não identificou parâmetros no áudio. Preencha manualmente ou grave de novo.';
export const AI_MIC_DENIED_HINT =
  'Sem acesso ao microfone. Preencha manualmente ou permita o microfone e tente de novo.';
export const AI_MIC_FAILED_HINT = 'Não foi possível gravar o áudio. Preencha manualmente ou tente de novo.';
export const EXTRA_NAME_REQUIRED_HINT = 'Informe o nome do parâmetro para salvar.';
export const AI_PLACEHOLDER = 'Grave um áudio com os valores do dia';

/** Parâmetro narrado que não está no catálogo: card extra, com nome e unidade editáveis, gravado só ao confirmar. */
interface ExtraParameter {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
}

/**
 * Registro diário (FT-004-7, US-004-7-01; Figma 4717-9855, desenhado pelo agente): seção "Parâmetros
 * assistenciais" em bottom-sheet no mobile e diálogo centralizado no desktop. Cada lançamento é um ponto novo.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    DailyEvolutionComponent,
    IconButtonComponent,
    InputChatComponent,
    PrescriptionGuidanceComponent,
  ],
  selector: 'app-daily-record-sheet',
  styleUrl: './daily-record-sheet.component.scss',
  templateUrl: './daily-record-sheet.component.html',
})
export class DailyRecordSheetComponent {
  readonly open = input(false);
  readonly patientId = input.required<string>();
  readonly closed = output();

  protected readonly parameters = signal<readonly ParameterDefinition[]>(INITIAL_PARAMETERS);
  protected readonly online = inject(ConnectivityService).online;
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);
  protected readonly saved = signal(false);
  protected readonly loadFailed = signal(false);
  /** Aviso de "nada para salvar". */
  protected readonly emptyHint = signal<string | null>(null);
  /** Erro de valor inválido por parâmetro. */
  protected readonly errors = signal<Readonly<Record<string, string>>>({});
  protected readonly offlineSaveHint = OFFLINE_SAVE_HINT;
  protected readonly saveFailedHint = SAVE_FAILED_HINT;
  protected readonly loadFailedHint = LOAD_FAILED_HINT;
  protected readonly savedHint = SAVED_HINT;
  protected readonly emptyHistoryText = EMPTY_HISTORY_TEXT;
  protected readonly aiPlaceholder = AI_PLACEHOLDER;
  protected readonly aiProcessingHint = AI_PROCESSING_HINT;
  protected readonly aiUnavailableHint = AI_UNAVAILABLE_HINT;
  protected readonly aiProcessing = signal(false);
  protected readonly aiNotice = signal<string | null>(null);
  /** Cards fora do catálogo vindos da IA, ainda não gravados. */
  protected readonly extras = signal<readonly ExtraParameter[]>([]);
  /** Nota em texto por card preenchido pela IA (some quando o profissional edita o campo). */
  protected readonly aiNotes = signal<Readonly<Record<string, string>>>({});
  protected readonly aiSuggestedNote = AI_SUGGESTED_NOTE;

  /** Histórico de hoje por parâmetro, do mais antigo ao mais recente (empate mantém a ordem de gravação). */
  protected readonly history = computed(() => {
    const reference = this.now();
    const byParameter = new Map<string, ParameterEntry[]>();
    const today = this.entries()
      .filter(entry => isSameDay(entry.at, reference))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    for (const entry of today) {
      byParameter.set(entry.parameterId, [...(byParameter.get(entry.parameterId) ?? []), entry]);
    }

    return byParameter;
  });

  private readonly entries = signal<readonly ParameterEntry[]>([]);
  private readonly drafts = signal<Readonly<Record<string, string>>>({});
  private readonly source = inject(DailyRecordSource);
  private readonly writer = inject(DailyRecordWriter);
  private readonly professional = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  private readonly structurer = inject(ParameterAiStructurer);
  private extraSequence = 0;
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
      if (this.open()) {
        const id = this.patientId();

        untracked(() => void this.load(id));
      }
    });
  }

  protected valueOf(id: string): string {
    return this.drafts()[id] ?? '';
  }

  protected edit(id: string, value: string): void {
    this.drafts.update(d => ({ ...d, [id]: value }));
    this.errors.update(e => ({ ...e, [id]: '' }));
    this.emptyHint.set(null);
    this.saved.set(false);
    this.aiNotes.update(({ [id]: _dropped, ...rest }) => rest);
  }

  protected editExtra(id: string, field: 'label' | 'unit', value: string): void {
    this.extras.update(list => list.map(x => (x.id === id ? { ...x, [field]: value } : x)));
    this.errors.update(e => ({ ...e, [id]: '' }));
    this.emptyHint.set(null);
    this.saved.set(false);
  }

  /** Áudio gravado: a IA estrutura os valores nos cards, ainda sem salvar; nada vale até "Salvar registro". */
  protected async onAudio(audio: Blob): Promise<void> {
    if (!this.online() || this.aiProcessing()) {
      return;
    }
    const token = this.token;

    this.aiNotice.set(null);
    this.aiProcessing.set(true);
    try {
      const suggestions = await this.structurer.suggest(audio);

      if (token !== this.token || !this.online()) {
        if (token === this.token) {
          this.aiNotice.set(AI_FAILED_HINT);
        }

        return;
      }
      if (suggestions.length === 0) {
        this.aiNotice.set(AI_EMPTY_HINT);

        return;
      }
      this.applySuggestions(suggestions);
    } catch {
      if (token === this.token) {
        this.aiNotice.set(AI_FAILED_HINT);
      }
    } finally {
      if (token === this.token) {
        this.aiProcessing.set(false);
      }
    }
  }

  protected onAudioError(reason: InputChatAudioError): void {
    this.aiNotice.set(reason === 'permission-denied' ? AI_MIC_DENIED_HINT : AI_MIC_FAILED_HINT);
  }

  /** Texto do último lançamento de hoje do parâmetro, ou a ajuda padrão quando ainda não há. */
  protected helpOf(parameter: ParameterDefinition): string {
    const last = this.historyOf(parameter.id).at(-1);

    return last
      ? `Último lançamento: ${formatParameterValue(last.value)} às ${formatEntryTime(last.at)}. Cada lançamento vira um ponto novo.`
      : parameter.help;
  }

  protected historyOf(parameterId: string): readonly ParameterEntry[] {
    return this.history().get(parameterId) ?? [];
  }

  protected valueText(entry: ParameterEntry): string {
    return formatParameterValue(entry.value);
  }

  protected timeText(entry: ParameterEntry): string {
    return formatEntryTime(entry.at);
  }

  protected labelOf(parameter: ParameterDefinition): string {
    return `${parameter.label} (${parameter.unit})`;
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

  /** Grava só os parâmetros preenchidos; nada é gravado se algum valor for inválido ou se nada foi preenchido. */
  protected async save(): Promise<void> {
    const filledExtras = this.extras().filter(x => this.valueOf(x.id).trim() !== '');
    const filled = [...this.parameters().filter(p => this.valueOf(p.id).trim() !== ''), ...filledExtras];

    this.saved.set(false);
    this.saveFailed.set(false);
    if (filled.length === 0) {
      this.emptyHint.set(NOTHING_TO_SAVE_HINT);

      return;
    }
    const errors: Record<string, string> = {};
    const at = this.now().toISOString();
    const author = this.professional.read().name;
    const entries: NewParameterEntry[] = [];

    for (const parameter of filled) {
      const value = parseParameterValue(this.valueOf(parameter.id));
      const extra = filledExtras.find(x => x.id === parameter.id);

      if (extra && extra.label.trim() === '') {
        errors[parameter.id] = EXTRA_NAME_REQUIRED_HINT;
      } else if (value === null) {
        errors[parameter.id] = INVALID_VALUE_HINT;
      } else if (extra) {
        const label = extra.label.trim();

        entries.push({
          at,
          author,
          parameterId: customParameterId(label),
          parameterLabel: label,
          unit: extra.unit.trim(),
          value,
        });
      } else {
        entries.push({ at, author, parameterId: parameter.id, value });
      }
    }
    this.errors.set(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    this.saving.set(true);
    try {
      const created = await this.writer.record(this.patientId(), entries);

      this.entries.update(list => [...list, ...created]);
      this.adoptCustomParameters(created);
      this.drafts.set({});
      this.extras.set([]);
      this.aiNotes.set({});
      this.saved.set(true);
    } catch {
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  private async load(patientId: string): Promise<void> {
    const token = ++this.token;

    this.drafts.set({});
    this.errors.set({});
    this.extras.set([]);
    this.aiNotes.set({});
    this.aiNotice.set(null);
    this.aiProcessing.set(false);
    this.parameters.set(INITIAL_PARAMETERS);
    this.emptyHint.set(null);
    this.saveFailed.set(false);
    this.saved.set(false);
    this.loadFailed.set(false);
    try {
      const loaded = await this.source.loadEntries(patientId);

      if (token === this.token) {
        this.entries.set(loaded);
        this.adoptCustomParameters(loaded);
      }
    } catch {
      if (token === this.token) {
        this.entries.set([]);
        this.loadFailed.set(true);
      }
    }
  }

  /** Parâmetros fora do catálogo já gravados passam a ter card próprio (a lista é aberta, FR-004). */
  private adoptCustomParameters(entries: readonly ParameterEntry[]): void {
    const known = new Set(this.parameters().map(p => p.id));
    const added: ParameterDefinition[] = [];

    for (const entry of entries) {
      if (entry.parameterId.startsWith(CUSTOM_PARAMETER_PREFIX) && !known.has(entry.parameterId)) {
        known.add(entry.parameterId);
        added.push({
          help: 'Cada lançamento vira um ponto novo.',
          id: entry.parameterId,
          label: entry.parameterLabel ?? entry.parameterId.slice(CUSTOM_PARAMETER_PREFIX.length),
          placeholder: 'Ex.: 10',
          unit: entry.unit ?? '',
        });
      }
    }
    if (added.length > 0) {
      this.parameters.update(list => [...list, ...added]);
    }
  }

  /** Preenche os cards (do catálogo ou extras) com o que a IA estruturou; avisa quando substitui o que foi digitado. */
  private applySuggestions(suggestions: readonly SuggestedParameter[]): void {
    const drafts = { ...this.drafts() };
    const notes = { ...this.aiNotes() };
    const errors = { ...this.errors() };
    let extras = [...this.extras()];

    for (const suggestion of suggestions) {
      const value = suggestion.value.trim();
      let id: string;
      const known = findParameter(this.parameters(), suggestion);

      if (known) {
        id = known.id;
      } else {
        const label = (suggestion.label ?? '').trim();
        const existing = extras.find(x => label !== '' && customParameterId(x.label) === customParameterId(label));

        if (existing) {
          id = existing.id;
        } else {
          id = `extra-${++this.extraSequence}`;
          extras = [...extras, { id, label, unit: (suggestion.unit ?? '').trim() }];
        }
      }
      const previous = (drafts[id] ?? '').trim();

      notes[id] =
        previous !== '' && previous !== value
          ? `${AI_SUGGESTED_NOTE} Substituiu o valor digitado (${previous}).`
          : AI_SUGGESTED_NOTE;
      drafts[id] = value;
      errors[id] = parseParameterValue(value) === null ? INVALID_VALUE_HINT : '';
    }
    this.extras.set(extras);
    this.drafts.set(drafts);
    this.aiNotes.set(notes);
    this.errors.set(errors);
    this.emptyHint.set(null);
    this.saved.set(false);
  }
}
