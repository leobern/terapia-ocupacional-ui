import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { IconButtonComponent } from '../../../shared/components/icon-button/icon-button.component';
import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import {
  AssistantEditorController,
  type EditorAction,
} from '../../../shared/services/assistant-editor-controller.service';
import { formatDayShortYear } from '../../../shared/utils/br-date';
import {
  bodyMassIndex,
  ClinicalAssessment,
  clinicalErrors,
  ClinicalItem,
  ClinicalItemTemplate,
  clinicalStatus,
  deviceLabel,
  formatClinicalNumber,
  itemSuggestions,
  parseClinicalValue,
  STATUS_TONES,
  StatusRange,
  StatusTone,
  tnLabel,
  toneLabel,
  withFixedItems,
} from './clinical-assessment.models';
import { ClinicalAssessmentSource } from './clinical-assessment-source';
import { ClinicalItemHistorySource } from './clinical-item-history-source';

/** Linha do editor de faixas de status de um item em edição (texto, para aceitar "11" ou "11,5" enquanto digita). */
interface DraftRange {
  readonly id: number;
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly tone: StatusTone;
}

/** Item do editor. `editing` = card de cadastro aberto (título, valor, unidade e faixas); senão, card de visualização. */
interface DraftItem {
  readonly id: string;
  readonly title: string;
  readonly value: string;
  readonly unit: string;
  readonly fixed: boolean;
  readonly editing: boolean;
  readonly ranges: readonly DraftRange[];
  readonly savedRanges: readonly StatusRange[];
}

export const CLINICAL_LOAD_FAILED_HINT = 'Não foi possível carregar a avaliação clínica. Tente novamente em instantes.';
export const CLINICAL_SAVE_FAILED_HINT = 'Não foi possível salvar. Os dados foram mantidos; tente novamente.';

/**
 * Editor da Avaliação clínica, aberto no painel lateral pelo lápis do título (Figma 4775:26535 e 4781:31732). Tipo de TN,
 * dispositivo, peso e altura são obrigatórios (cadastrados com o paciente) e o IMC é calculado deles; NRS-2002, GLIM e
 * SARC-F são protocolos fixos (não se excluem). Os demais itens são livres: o usuário abre um card de cadastro (título,
 * valor, unidade e faixas de status com cor), confirma no ✓ e ele vira um card de visualização; o X cancela com
 * confirmação. As ações ("Adicionar novo item", "Salvar") ficam no rodapé do painel, acima do campo de mensagem.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, IconButtonComponent],
  selector: 'app-clinical-assessment-editor',
  styleUrl: './clinical-assessment-editor.component.scss',
  templateUrl: './clinical-assessment-editor.component.html',
})
export class ClinicalAssessmentEditorComponent {
  readonly patientId = input.required<string>();
  /** Chamado depois de salvar, para a tela ler a avaliação de novo. */
  readonly saved = input<() => void>(() => undefined);

  protected readonly state = signal<'error' | 'loading' | 'ready'>('loading');
  protected readonly tnType = signal('');
  protected readonly device = signal('');
  protected readonly weight = signal('');
  protected readonly height = signal('');
  protected readonly previousWeight = signal<ClinicalAssessment['previousWeight']>(undefined);
  protected readonly items = signal<readonly DraftItem[]>([]);
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);
  /** Itens em que o ✓ foi tentado com título ou valor vazio (mostra o erro no card). */
  protected readonly attempted = signal<ReadonlySet<string>>(new Set());
  /** Item cuja exclusão aguarda a confirmação ("Sim" ou "Não"). */
  protected readonly removeTarget = signal<DraftItem | null>(null);
  /** Item novo cujo cancelamento (X) aguarda a confirmação. */
  protected readonly cancelTarget = signal<DraftItem | null>(null);
  /** Faixa com o seletor de cor aberto. */
  protected readonly colorOpen = signal<{ readonly itemId: string; readonly rangeId: number } | null>(null);
  /** Onde as tags de cor flutuam (canto do ponto tocado, em pixels da janela). */
  protected readonly palettePosition = signal({ left: 0, top: 0 });
  protected readonly loadFailedHint = CLINICAL_LOAD_FAILED_HINT;
  protected readonly saveFailedHint = CLINICAL_SAVE_FAILED_HINT;
  protected readonly tones = STATUS_TONES;

  protected readonly weightNumber = computed(() => parseClinicalValue(this.weight()));
  protected readonly heightNumber = computed(() => parseClinicalValue(this.height()));
  protected readonly tnHint = computed(() => tnLabel(this.tnType()));
  protected readonly deviceHint = computed(() => deviceLabel(this.device()));
  protected readonly bmi = computed(() => {
    const value = bodyMassIndex(this.weightNumber(), this.heightNumber());

    return value === null ? null : formatClinicalNumber(value);
  });
  protected readonly errors = computed(() =>
    clinicalErrors({
      device: this.device(),
      heightCm: this.heightNumber(),
      tnType: this.tnType(),
      weightKg: this.weightNumber(),
    }),
  );
  /** Histórico de itens já cadastrados pelo profissional (do mais recente), para sugerir um novo cadastro. */
  protected readonly history = signal<readonly ClinicalItemTemplate[]>([]);
  /** Sugestões: histórico e tipos padrão das USs que ainda não estão na avaliação deste paciente. */
  protected readonly suggestions = computed(() =>
    itemSuggestions(
      this.history(),
      this.items().map(i => i.title),
    ),
  );
  protected readonly removeTitle = computed(() => `Excluir ${this.removeTarget()?.title ?? 'o item'}?`);

  private readonly scrim = viewChild<ElementRef<HTMLElement>>('scrim');
  private readonly source = inject(ClinicalAssessmentSource);
  private readonly historySource = inject(ClinicalItemHistorySource);
  private readonly assistant = inject(AiAssistantService);
  private readonly editor = inject(AssistantEditorController);
  private nextId = 1;
  private token = 0;

  constructor() {
    // O fundo escurecido e as tags vão para a camada superior do navegador: cobrem o sistema todo, não só o painel.
    effect(() => {
      const element = this.scrim()?.nativeElement;

      if (element !== undefined && !element.matches(':popover-open')) {
        element.showPopover();
      }
    });
    effect(() => {
      const id = this.patientId();

      untracked(() => {
        void this.load(id);
        void this.loadHistory();
      });
    });
    effect(onCleanup => {
      const actions = signal<readonly EditorAction[]>([
        { id: 'add', label: 'Adicionar novo item' },
        { id: 'save', label: 'Salvar' },
      ]);

      onCleanup(
        this.editor.attach({
          actions,
          placeholder: 'Escreva a sua mensagem',
          run: (action): void => {
            if (action === 'add') {
              this.addItem();
            } else {
              void this.save();
            }
          },
        }),
      );
    });
  }

  /** Instante ISO (API) vira `dd/mm/aa`; texto que já vem só com `dd/mm` fica como está. */
  protected previousDate(at: string): string {
    return /^\d{4}-/u.test(at) ? formatDayShortYear(new Date(at)) : at;
  }

  protected status(item: DraftItem): { label: string; tone: StatusTone } | null {
    return clinicalStatus({ ranges: item.savedRanges, value: item.value });
  }

  protected toneName(tone: StatusTone): string {
    return toneLabel(tone);
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected setItem(id: string, change: Partial<Pick<DraftItem, 'title' | 'unit' | 'value'>>): void {
    this.items.update(list => list.map(i => (i.id === id ? { ...i, ...change } : i)));
  }

  protected addItem(): void {
    this.openEditing({ ranges: [], title: '', unit: '' });
  }

  /** Sugestão escolhida: card de cadastro já com título, unidade e faixas do modelo; falta só o valor. */
  protected addFromTemplate(template: ClinicalItemTemplate): void {
    this.openEditing(template);
  }

  protected addRange(itemId: string): void {
    const range: DraftRange = { from: '', id: this.nextId++, label: '', to: '', tone: 'alert' };

    this.items.update(list => list.map(i => (i.id === itemId ? { ...i, ranges: [...i.ranges, range] } : i)));
  }

  protected setRange(itemId: string, rangeId: number, change: Partial<Omit<DraftRange, 'id'>>): void {
    this.items.update(list =>
      list.map(i =>
        i.id === itemId ? { ...i, ranges: i.ranges.map(r => (r.id === rangeId ? { ...r, ...change } : r)) } : i,
      ),
    );
  }

  protected removeRange(itemId: string, rangeId: number): void {
    this.items.update(list =>
      list.map(i => (i.id === itemId ? { ...i, ranges: i.ranges.filter(r => r.id !== rangeId) } : i)),
    );
    if (this.colorOpen()?.rangeId === rangeId) {
      this.colorOpen.set(null);
    }
  }

  /** Abre o seletor de cor sobre o ponto tocado; tocar de novo (ou no fundo) fecha. */
  protected toggleColor(itemId: string, rangeId: number, event: Event): void {
    const open = this.colorOpen();

    if (open?.itemId === itemId && open.rangeId === rangeId) {
      this.colorOpen.set(null);

      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    this.palettePosition.set({ left: Math.max(8, rect.left - 4), top: Math.max(8, rect.top - 4) });
    this.colorOpen.set({ itemId, rangeId });
  }

  protected closeColor(): void {
    this.colorOpen.set(null);
  }

  /** Cores ainda não escolhidas na faixa aberta: a escolhida some da lista. */
  protected otherTones(itemId: string, rangeId: number): typeof STATUS_TONES {
    const current = this.items()
      .find(i => i.id === itemId)
      ?.ranges.find(r => r.id === rangeId)?.tone;

    return STATUS_TONES.filter(tone => tone.value !== current);
  }

  protected pickTone(itemId: string, rangeId: number, tone: StatusTone): void {
    this.setRange(itemId, rangeId, { tone });
    this.colorOpen.set(null);
  }

  /** ✓: confirma o item; ele vira um card de visualização, como os outros. */
  protected commitItem(item: DraftItem): void {
    if (item.title.trim() === '' || item.value.trim() === '') {
      this.attempted.update(set => new Set(set).add(item.id));

      return;
    }
    this.items.update(list =>
      list.map(i =>
        i.id === item.id
          ? { ...i, editing: false, ranges: [], savedRanges: this.toRanges(i.ranges), title: i.title.trim() }
          : i,
      ),
    );
    this.colorOpen.set(null);
  }

  /** X do card de cadastro: pergunta se realmente quer remover o item. */
  protected askCancel(item: DraftItem): void {
    this.cancelTarget.set(item);
  }

  protected confirmCancel(): void {
    const target = this.cancelTarget();

    if (target !== null) {
      this.items.update(list => list.filter(i => i.id !== target.id));
    }
    this.cancelTarget.set(null);
  }

  protected keepEditing(): void {
    this.cancelTarget.set(null);
  }

  /** Lixeira de um card de visualização: pede confirmação antes de excluir. */
  protected askRemove(item: DraftItem): void {
    this.removeTarget.set(item);
  }

  protected confirmRemove(): void {
    const target = this.removeTarget();

    if (target !== null) {
      this.items.update(list => list.filter(i => i.id !== target.id));
    }
    this.removeTarget.set(null);
  }

  protected cancelRemove(): void {
    this.removeTarget.set(null);
  }

  protected itemError(item: DraftItem): string | null {
    if (!item.editing || !(this.attempted().has(item.id) || this.submitted())) {
      return null;
    }
    if (item.title.trim() === '') {
      return 'Informe o título.';
    }

    return item.value.trim() === '' ? 'Informe o valor.' : null;
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    const editing = this.items().filter(i => i.editing);
    const blocked =
      Object.keys(this.errors()).length > 0 || editing.some(i => i.title.trim() === '' || i.value.trim() === '');

    if (blocked || this.saving()) {
      return;
    }
    const assessment: ClinicalAssessment = {
      device: this.device().trim(),
      heightCm: this.heightNumber(),
      items: this.items().map((i): ClinicalItem => ({
        fixed: i.fixed,
        id: i.editing || i.id.startsWith('new-') ? `item-${Date.now()}-${i.id}` : i.id,
        ranges: i.editing ? this.toRanges(i.ranges) : i.savedRanges,
        title: i.title.trim(),
        unit: i.unit.trim(),
        value: i.value.trim(),
      })),
      previousWeight: this.previousWeight(),
      tnType: this.tnType().trim().toUpperCase(),
      weightKg: this.weightNumber(),
    };

    this.saving.set(true);
    this.saveFailed.set(false);
    try {
      await this.source.save(this.patientId(), assessment);
      // Lembra os itens para sugerir um novo cadastro; falhar em lembrar não impede salvar.
      await this.historySource
        .remember(assessment.items.map(i => ({ ranges: i.ranges, title: i.title, unit: i.unit })))
        .catch(() => undefined);
      this.saved()();
      this.assistant.closePanel();
    } catch {
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  private openEditing(template: ClinicalItemTemplate): void {
    const id = `new-${this.nextId++}`;
    const ranges: readonly DraftRange[] = template.ranges.map(r => ({
      from: String(r.from),
      id: this.nextId++,
      label: r.label,
      to: String(r.to),
      tone: r.tone,
    }));

    this.items.update(list => [
      ...list,
      {
        editing: true,
        fixed: false,
        id,
        ranges,
        savedRanges: [],
        title: template.title,
        unit: template.unit,
        value: '',
      },
    ]);
  }

  private toRanges(ranges: readonly DraftRange[]): readonly StatusRange[] {
    return ranges.flatMap(r => {
      const from = parseClinicalValue(r.from);
      const to = parseClinicalValue(r.to);

      return from === null || to === null || r.label.trim() === ''
        ? []
        : [{ from, label: r.label.trim(), to, tone: r.tone }];
    });
  }

  private async loadHistory(): Promise<void> {
    try {
      this.history.set(await this.historySource.load());
    } catch {
      // sem histórico: ficam só os tipos padrão
    }
  }

  private async load(patientId: string): Promise<void> {
    const token = ++this.token;

    this.state.set('loading');
    try {
      const a = await this.source.load(patientId);

      if (token !== this.token) {
        return;
      }
      this.tnType.set(a.tnType);
      this.device.set(a.device);
      this.weight.set(a.weightKg === null ? '' : formatClinicalNumber(a.weightKg));
      this.height.set(a.heightCm === null ? '' : String(a.heightCm));
      this.previousWeight.set(a.previousWeight);
      this.items.set(
        withFixedItems(a.items).map(i => ({
          editing: false,
          fixed: i.fixed === true,
          id: i.id,
          ranges: [],
          savedRanges: i.ranges,
          title: i.title,
          unit: i.unit,
          value: i.value,
        })),
      );
      this.state.set('ready');
    } catch {
      if (token === this.token) {
        this.state.set('error');
      }
    }
  }
}
