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
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import {
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
} from './daily-record.models';
import { DailyRecordSource } from './daily-record-source';
import { DailyRecordWriter } from './daily-record-writer';

export const SAVE_FAILED_HINT =
  'Não foi possível salvar o registro. Os valores digitados foram mantidos; tente novamente.';
export const OFFLINE_SAVE_HINT =
  'Sem conexão: salvar fica indisponível. Você pode continuar preenchendo; os valores serão mantidos.';
export const LOAD_FAILED_HINT = 'Não foi possível carregar os lançamentos de hoje. Você ainda pode registrar valores.';
export const SAVED_HINT = 'Registro salvo.';

/**
 * Registro diário (FT-004-7, US-004-7-01; Figma 4717-9855, desenhado pelo agente): seção "Parâmetros
 * assistenciais" em bottom-sheet no mobile e diálogo centralizado no desktop. Cada lançamento é um ponto novo.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, IconButtonComponent],
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

  /** Lançamentos de hoje, do mais antigo ao mais recente. */
  protected readonly today = computed(() => {
    const reference = this.now();

    return this.entries()
      .filter(entry => isSameDay(entry.at, reference))
      .sort((a, b) => a.at.localeCompare(b.at));
  });

  private readonly entries = signal<readonly ParameterEntry[]>([]);
  private readonly drafts = signal<Readonly<Record<string, string>>>({});
  private readonly source = inject(DailyRecordSource);
  private readonly writer = inject(DailyRecordWriter);
  private readonly professional = inject(ProfessionalProfileReader);
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
  }

  /** Texto do último lançamento de hoje do parâmetro, ou a ajuda padrão quando ainda não há. */
  protected helpOf(parameter: ParameterDefinition): string {
    const last = this.today()
      .filter(entry => entry.parameterId === parameter.id)
      .at(-1);

    return last
      ? `Último lançamento: ${formatParameterValue(last.value)} às ${formatEntryTime(last.at)}. Cada lançamento vira um ponto novo.`
      : parameter.help;
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
    const filled = this.parameters().filter(p => this.valueOf(p.id).trim() !== '');

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

      if (value === null) {
        errors[parameter.id] = INVALID_VALUE_HINT;
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
      this.drafts.set({});
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
    this.emptyHint.set(null);
    this.saveFailed.set(false);
    this.saved.set(false);
    this.loadFailed.set(false);
    try {
      const loaded = await this.source.loadEntries(patientId);

      if (token === this.token) {
        this.entries.set(loaded);
      }
    } catch {
      if (token === this.token) {
        this.entries.set([]);
        this.loadFailed.set(true);
      }
    }
  }
}
