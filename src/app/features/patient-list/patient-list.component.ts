import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  NgZone,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { DateStripComponent } from '../../shared/components/date-strip/date-strip.component';
import { GraphMetaComponent } from '../../shared/components/graph-meta/graph-meta.component';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SwipeRowComponent } from '../../shared/components/swipe-row/swipe-row.component';
import { TherapyTagComponent } from '../../shared/components/therapy-tag/therapy-tag.component';
import { PhIconComponent } from '../../shared/icons/ph-icon/ph-icon.component';
import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { type ScreenAction, ScreenActionsService } from '../../shared/services/screen-actions.service';
import { PATIENTS_CONTEXT } from '../../shared/services/screen-contexts';
import { ClosurePatient, FollowUpClosureSheetComponent } from '../follow-up-closure/follow-up-closure-sheet.component';
import { HospitalContextService } from '../home/hospital-context.service';
import { UnreadNotificationsReader } from '../home/unread-notifications-reader';
import { PatientRegistrationAction } from '../patient-registration/patient-registration.action';
import { adequacyLabel, goalLabel, hasAdequacy, therapyStartLabel } from './patient-card-labels';
import { PatientCard, TherapyType } from './patient-list.models';
import { PatientListAiCommandPort } from './patient-list-ai-command';
import { assemblePatientList } from './patient-list-assembly';
import { PatientListSource } from './patient-list-source';

export interface PatientGroup {
  readonly key: string;
  readonly title: string;
  readonly patients: readonly PatientCard[];
}

function lowestGoal(adequacy: PatientCard['adequacy']): number {
  const values = [adequacy?.caloric ?? null, adequacy?.protein ?? null].filter((v): v is number => v !== null);

  return values.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...values);
}

/** Fora da meta: ao menos uma adequação disponível abaixo de 50% (faixas alerta e crítico). */
function isOutOfTarget(adequacy: PatientCard['adequacy']): boolean {
  return lowestGoal(adequacy) < 50;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export type ColumnKey = 'name' | 'age' | 'therapy' | 'caloric' | 'protein' | 'location' | 'first';

/** Larguras padrão (px) da tabela do desktop; o usuário ajusta arrastando a divisória do cabeçalho. */
const DEFAULT_WIDTHS: Readonly<Record<ColumnKey, number>> = {
  age: 150,
  caloric: 170,
  first: 170,
  location: 170,
  name: 280,
  protein: 170,
  therapy: 120,
};
const MIN_WIDTH: Readonly<Record<ColumnKey, number>> = {
  age: 110,
  caloric: 130,
  first: 170,
  location: 130,
  name: 180,
  protein: 130,
  therapy: 130,
};
const COLUMN_ORDER: readonly ColumnKey[] = ['name', 'age', 'therapy', 'caloric', 'protein', 'location', 'first'];
const MAX_WIDTH = 560;
const ACTION_COLUMN_WIDTH = 72;
const KEY_STEP = 16;

export type SortKey = 'name' | 'age' | 'therapy' | 'caloric' | 'protein' | 'location';
export type SortDirection = 'asc' | 'desc';

/** Critérios pré-definidos dos chips do painel de Atalhos (FR-019). */
export type PresetSort = 'priority' | 'bed';

const SORT_OPTIONS = [
  { id: 'priority', label: 'Por prioridade' },
  { id: 'bed', label: 'Por leito' },
] as const;

const BED_COLLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/** Voltar a ficar visível rebusca a lista; oculto não busca (FR-035). */
export function refreshesOnVisibility(state: DocumentVisibilityState): boolean {
  return state === 'visible';
}

export type PatientListStatus = 'loading' | 'ready' | 'error';

const PATIENT_LIST_ACTIONS: readonly ScreenAction[] = [
  { id: 'end-follow-up', label: 'Encerrar acompanhamento' },
  { id: 'change-bed', label: 'Alterar leito' },
];

const THERAPY_LABEL: Record<TherapyType, string> = { MISTA: 'VO · NE · NP', NE: 'NE', NP: 'NP', VO: 'VO' };

/** Valor de ordenação de cada coluna; `null` = indisponível. */
const SORT_VALUE: Readonly<Record<SortKey, (p: PatientCard) => number | string | null>> = {
  age: p => p.age,
  caloric: p => p.adequacy?.caloric ?? null,
  location: p => `${p.ward} ${p.bed}`,
  name: p => p.name,
  protein: p => p.adequacy?.protein ?? null,
  therapy: p => THERAPY_LABEL[p.therapy],
};

/**
 * Jornada Clínica — lista de pacientes da EMTN do hospital em contexto, na data de hoje
 * (US-004-1-01). Só exibe e navega: não produz dado clínico (FR-038).
 */
/** Arrasto mínimo (px) do puxar-para-atualizar. */
const PULL_THRESHOLD = 80;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    ConfirmDialogComponent,
    DateStripComponent,
    FollowUpClosureSheetComponent,
    GraphMetaComponent,
    IconButtonComponent,
    PageHeaderComponent,
    PageContainerComponent,
    PhIconComponent,
    SwipeRowComponent,
    TherapyTagComponent,
  ],
  selector: 'app-patient-list',
  styleUrl: './patient-list.component.scss',
  templateUrl: './patient-list.component.html',
  host: {
    '(window:focus)': 'refresh()',
    '(document:visibilitychange)': 'onVisibility()',
  },
})
export class PatientListComponent implements OnInit {
  readonly selectedDate = signal(new Date());
  /** Data retroativa aguardando confirmação (FR-012): enquanto existir, data e lista não mudam. */
  readonly pendingDate = signal<Date | null>(null);
  /**
   * Modo somente leitura (FR-013/FR-014): qualquer data diferente de hoje (datas futuras seguem o mesmo
   * caminho, a confirmar no refinamento). Os swipes das US-004-1-08/09 devem consultar este sinal.
   */
  readonly readOnly = computed(() => !isSameDay(this.selectedDate(), this.today));
  readonly pendingTitle = computed(() => `Ver o dia ${this.pendingDate()?.getDate() ?? ''} de ${this.pendingMonth()}?`);
  readonly pendingConfirmLabel = computed(() => `Ver o dia ${this.pendingDate()?.getDate() ?? ''}`);
  readonly status = signal<PatientListStatus>('loading');
  readonly patients = signal<readonly PatientCard[]>([]);
  readonly hospitalName = computed(() => this.context.selected()?.name ?? '');
  readonly unreadCount = signal(0);
  /** Aviso (texto, não só cor) quando o encerramento é tentado sem conexão (Offline da US-004-1-08). */
  readonly offlineNotice = signal('');
  /** Paciente do modal de encerramento aberto pelo swipe (FT-004-9); `null` = fechado. */
  readonly closureTarget = signal<ClosurePatient | null>(null);
  /** Larguras das colunas (V1: só nesta sessão; a persistência por usuário fica para a V2 com o perfil). */
  readonly widths = signal<Readonly<Record<ColumnKey, number>>>(DEFAULT_WIDTHS);
  readonly resizing = signal<ColumnKey | null>(null);
  /** Botão de ajustar: só aparece quando as colunas precisam de ajuste (usuário mexeu ou há rolagem). */
  readonly fitState = signal<'needs' | 'fitted'>('fitted');
  /** Coluna sob o mouse no cabeçalho: mostra a linha de divisória contínua. */
  readonly hoverColumn = signal<ColumnKey | null>(null);
  readonly lineIndex = computed(() => {
    const dragging = this.resizing();

    if (dragging !== null) {
      return COLUMN_ORDER.indexOf(dragging) + 2;
    }
    const hovered = this.hoverColumn();

    return hovered === null || hovered === 'name' ? null : COLUMN_ORDER.indexOf(hovered) + 1;
  });
  readonly tableMinWidth = computed(
    () => Object.values(this.widths()).reduce((sum, w) => sum + w, 0) + ACTION_COLUMN_WIDTH,
  );
  /** A tabela do desktop ganhou rolagem horizontal (mostra a borda da coluna fixa). */
  readonly tableScrolls = signal(false);
  /**
   * Ordenação pré-definida ativa (FR-019..022). `null` = nenhum chip acionado ainda: a lista segue a ordem
   * estável por leito (suposição da story, a confirmar com UX). Fica na tela enquanto ela estiver aberta,
   * independente da data selecionada.
   */
  // Padrão: prioridade (Fora/Dentro da meta), como no Figma "Ordenar: prioridade".
  readonly presetSort = signal<PresetSort | null>('priority');
  /** Texto da tag "Ordenar: …" (padrão: prioridade, ver `presetSort`). */
  readonly sortLabel = computed(() => (this.presetSort() === 'priority' ? 'prioridade' : 'leito'));
  readonly activeSort = computed<string | null>(() => this.presetSort());
  /** Prioridade: quem está fora da meta primeiro, do mais crítico ao menos. Leito: grupos por ala, leitos em ordem numérica. */
  readonly groups = computed<readonly PatientGroup[]>(() =>
    this.presetSort() === 'priority' ? this.priorityGroups() : this.bedGroups(),
  );
  /** Ordenação da tabela: uma coluna ordena todas as outras. Padrão: localização, crescente. */
  readonly sortKey = signal<SortKey>('location');
  readonly sortDir = signal<SortDirection>('asc');
  readonly sorted = computed(() => {
    const value = SORT_VALUE[this.sortKey()];
    const sign = this.sortDir() === 'asc' ? 1 : -1;
    const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
    const present = this.patients().filter(p => value(p) !== null);
    // Sem dado (indisponível) fica sempre no fim, em qualquer direção.
    const missing = this.patients().filter(p => value(p) === null);

    present.sort((a, b) => {
      const x = value(a) as number | string;
      const y = value(b) as number | string;

      return (typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y))) * sign;
    });

    return [...present, ...missing];
  });
  /** Título do cabeçalho: contagem quando carregou, senão o nome da área. */
  readonly title = computed(() => (this.status() === 'ready' ? this.countLabel() : 'Pacientes'));
  /** Contexto abaixo do título: hospital, modo somente leitura e quantos estão fora da meta. */
  readonly subtitle = computed(() => {
    const parts = [this.hospitalName()];

    if (this.readOnly()) {
      parts.push('Somente leitura');
    }
    if (this.status() === 'ready') {
      parts.push(this.outOfTargetCount() + ' fora da meta');
    }

    return parts.join(' · ');
  });
  readonly outOfTargetCount = computed(() => this.patients().filter(p => isOutOfTarget(p.adequacy)).length);
  readonly countLabel = computed(() => {
    const n = this.patients().length;

    return `${n} ${n === 1 ? 'paciente' : 'pacientes'}`;
  });

  protected readonly therapyStartLabel = therapyStartLabel;
  protected readonly adequacyLabel = adequacyLabel;
  protected readonly hasAdequacy = hasAdequacy;
  protected readonly goalLabel = goalLabel;
  protected readonly aiAssistant = inject(AiAssistantService);

  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  private readonly context = inject(HospitalContextService);
  private readonly source = inject(PatientListSource);
  private readonly router = inject(Router);
  private readonly connectivity = inject(ConnectivityService);
  private readonly tableCard = viewChild<ElementRef<HTMLElement>>('tableCard');
  private readonly unread = inject(UnreadNotificationsReader);
  private readonly screenActions = inject(ScreenActionsService);
  private readonly patientRegistration = inject(PatientRegistrationAction);
  private readonly aiCommand = inject(PatientListAiCommandPort);
  private readonly priorityGroups = computed<readonly PatientGroup[]>(() => {
    const out = this.patients()
      .filter(p => isOutOfTarget(p.adequacy))
      .sort((a, b) => lowestGoal(a.adequacy) - lowestGoal(b.adequacy));
    const within = this.patients().filter(p => !isOutOfTarget(p.adequacy));

    return [
      { key: 'out', patients: out, title: 'Fora da meta' },
      { key: 'in', patients: within, title: 'Dentro da meta' },
    ].filter(g => g.patients.length > 0);
  });
  private readonly bedGroups = computed<readonly PatientGroup[]>(() => {
    const byWard = new Map<string, PatientCard[]>();

    for (const patient of this.patients()) {
      byWard.set(patient.ward, [...(byWard.get(patient.ward) ?? []), patient]);
    }

    return [...byWard.entries()]
      .sort(([a], [b]) => BED_COLLATOR.compare(a, b))
      .map(([ward, patients]) => ({
        key: `ward:${ward}`,
        patients: [...patients].sort((a, b) => BED_COLLATOR.compare(a.bed, b.bed)),
        title: ward,
      }));
  });
  private generation = 0;
  private pullFrom: number | null = null;
  private readonly today = new Date();
  private readonly pendingMonth = computed(() => {
    const d = this.pendingDate();

    return d === null ? '' : MONTHS[d.getMonth()];
  });

  constructor() {
    effect(onCleanup => {
      onCleanup(this.screenActions.registerContext(PATIENTS_CONTEXT));
    });

    // Atalhos da tela (padrão de cadastro): ações principais; os cadastro e edição navegam à FT-002-1 (US-004-1-07).
    // Em modo somente leitura (FR-014) todas levam a fluxos de escrita e saem dos atalhos.
    effect(onCleanup => {
      const actions: readonly ScreenAction[] = this.readOnly()
        ? []
        : [
            this.patientRegistration.build(),
            { id: 'edit-patient', label: 'Alterar dados de paciente', navigate: (): void => this.editPatient() },
            ...PATIENT_LIST_ACTIONS,
          ];

      onCleanup(this.screenActions.register(actions));
    });
    // Chips de ordenação no painel de Atalhos: ordenar não altera dado do paciente, vale também em modo leitura.
    effect(onCleanup => {
      onCleanup(
        this.screenActions.registerSort({
          active: this.activeSort,
          options: SORT_OPTIONS,
          select: id => this.selectSort(id as PresetSort),
        }),
      );
    });
    // Comando de IA (texto/áudio) do painel de Atalhos: só encaminhado à FT-003-4, nunca interpretado aqui.
    // Não altera dado do paciente, então vale também em modo somente leitura.
    effect(onCleanup => {
      onCleanup(this.screenActions.registerCommandHandler(command => this.aiCommand.send(command)));
    });
    const zone = inject(NgZone);

    // Observa o card da tabela: rolagem horizontal só existe quando o conteúdo passa da largura.
    effect(onCleanup => {
      const card = this.tableCard()?.nativeElement;

      if (card === undefined || typeof ResizeObserver === 'undefined') {
        return;
      }
      // O ResizeObserver roda fora da zona: reentra nela para a tela atualizar na hora.
      const update = (): void =>
        zone.run(() => {
          const scrolls = card.scrollWidth > card.clientWidth + 1;

          // Rolagem que passa a existir volta a oferecer o botão de ajustar.
          if (scrolls && !this.tableScrolls()) {
            this.fitState.set('needs');
          }
          this.tableScrolls.set(scrolls);
        });
      const observer = new ResizeObserver(update);

      observer.observe(card);
      if (card.firstElementChild !== null) {
        observer.observe(card.firstElementChild);
      }
      update();
      onCleanup(() => observer.disconnect());
    });

    effect(() => {
      const hospitalId = this.context.selected()?.id;
      const day = this.selectedDate();

      if (hospitalId !== undefined) {
        void this.load(hospitalId, day);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.unreadCount.set(await this.unread.countUnread());
  }

  async load(hospitalId: number, day: Date = this.selectedDate()): Promise<void> {
    const generation = ++this.generation;

    this.status.set('loading');
    try {
      const census = await this.source.loadCensus(hospitalId, day);

      if (generation === this.generation) {
        this.patients.set(assemblePatientList(census, hospitalId, day));
        this.status.set('ready');
      }
    } catch {
      if (generation === this.generation) {
        this.status.set('error');
      }
    }
  }

  /**
   * Nova busca silenciosa (FR-035/FR-036/FR-039): ao receber foco ou puxar-para-atualizar. Mantém a lista
   * atual (sem piscar), a ordenação e a data; sem conexão ou com erro, segue o último cache local.
   */
  async refresh(): Promise<void> {
    const id = this.context.selected()?.id;

    if (id === undefined || !this.connectivity.online() || this.status() === 'loading') {
      return;
    }
    const generation = ++this.generation;
    const day = this.selectedDate();

    try {
      const census = await this.source.loadCensus(id, day);

      if (generation === this.generation) {
        this.patients.set(assemblePatientList(census, id, day));
        this.status.set('ready');
      }
    } catch {
      // Mantém o último cache exibido.
    }
  }

  /** Chip acionado: o novo critério substitui o anterior; acionar o ativo o mantém (FR-021). */
  selectSort(sort: PresetSort): void {
    this.presetSort.set(sort);
  }

  retry(): void {
    const id = this.context.selected()?.id;

    if (id !== undefined) {
      void this.load(id);
    }
  }

  openNotifications(): void {
    void this.router.navigate(['/notifications']);
  }

  /** Clique no título: nova coluna ordena crescente; a mesma coluna alterna crescente e decrescente. */
  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  /** Arrasta a divisória do cabeçalho para ajustar a largura da coluna. */
  startResize(event: PointerEvent, key: ColumnKey): void {
    const handle = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    // A alça fica na borda esquerda do cabeçalho seguinte: a coluna ajustada é a anterior.
    const startWidth =
      handle.closest('th')?.previousElementSibling?.getBoundingClientRect().width ?? this.widths()[key];

    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture(event.pointerId);
    this.resizing.set(key);

    const move = (e: PointerEvent): void => this.setWidth(key, startWidth + e.clientX - startX);
    const stop = (): void => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
      this.resizing.set(null);
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  /**
   * Ajusta as colunas à largura útil do card, sem rolagem horizontal. 1º tenta o tamanho padrão; se não
   * couber, reduz em proporção ao padrão;
   * nenhuma passa do mínimo (colunas no mínimo ficam fixas e o resto se reparte). Se nem todas no
   * mínimo cabem, todas ficam no mínimo e a rolagem horizontal continua.
   */
  fitColumns(): void {
    const card = this.tableCard()?.nativeElement;
    const available = (card?.clientWidth ?? 0) - ACTION_COLUMN_WIDTH;
    const current = DEFAULT_WIDTHS;

    // 1ª regra: se o tamanho padrão cabe na área útil, volta ao padrão (a tabela só estica).
    if (COLUMN_ORDER.reduce((sum, k) => sum + DEFAULT_WIDTHS[k], 0) <= available) {
      this.widths.set(DEFAULT_WIDTHS);
      this.fitState.set('fitted');

      return;
    }
    const result: Record<ColumnKey, number> = { ...MIN_WIDTH };
    let free = [...COLUMN_ORDER];
    let remaining = available;

    while (free.length > 0 && remaining > 0) {
      const scale = remaining / free.reduce((sum, k) => sum + current[k], 0);
      const below = free.filter(k => current[k] * scale < MIN_WIDTH[k]);

      if (below.length === 0) {
        free.forEach(k => (result[k] = Math.floor(Math.min(MAX_WIDTH, current[k] * scale))));
        break;
      }
      below.forEach(k => (remaining -= MIN_WIDTH[k]));
      free = free.filter(k => !below.includes(k));
    }

    this.widths.set(result);
    this.fitState.set('fitted');
  }

  /** Teclado: setas esquerda e direita ajustam a coluna em passos de 16px; Home volta ao padrão. */
  resizeByKey(event: KeyboardEvent, key: ColumnKey): void {
    if (event.key === 'Home') {
      this.setWidth(key, DEFAULT_WIDTHS[key]);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      this.setWidth(key, this.widths()[key] + (event.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP));
    } else {
      return;
    }
    event.preventDefault();
  }

  /** Cadastro pertence à FT-002-1: aqui só navega (FR-027). */
  registerPatient(): void {
    void this.router.navigate(['/patients', 'register']);
  }

  /** Alteração de dados pertence à FT-002-1: entrada do fluxo de edição, onde o paciente é escolhido (FR-027). */
  editPatient(): void {
    void this.router.navigate(['/patients', 'edit']);
  }

  /**
   * Troca a data do carrossel; a lista recarrega via effect. Voltar a hoje restaura o modo normal sem alerta
   * (FR-015); qualquer outra data pede confirmação antes de aplicar (FR-012).
   */
  selectDate(day: Date): void {
    if (isSameDay(day, this.today)) {
      this.pendingDate.set(null);
      this.selectedDate.set(day);
    } else {
      this.pendingDate.set(day);
    }
  }

  confirmPendingDate(): void {
    const day = this.pendingDate();

    if (day !== null) {
      this.selectedDate.set(day);
      this.pendingDate.set(null);
    }
  }

  cancelPendingDate(): void {
    this.pendingDate.set(null);
  }

  /**
   * Swipe à esquerda (FR-029): abre o modal de encerramento da FT-004-9 (o mesmo do Hub) com o paciente em
   * contexto. Só lê: a gravação e a exigência de conexão ficam no modal (FR-001a).
   */
  endFollowUp(id: string): void {
    const patient = this.patients().find(p => p.id === id);

    if (this.readOnly() || patient === undefined) {
      return;
    }
    this.offlineNotice.set('');
    this.closureTarget.set({ bed: patient.bed, id: patient.id, name: patient.name, ward: patient.ward });
  }

  /** Encerramento gravado: o paciente sai da lista a partir da data de efeito (FR-005). */
  closureSaved(): void {
    this.retry();
  }

  closeClosure(): void {
    this.closureTarget.set(null);
  }

  /**
   * Swipe à direita (FR-033): só navega ao fluxo de alteração de leito da FT-002-2 (rota provisória),
   * com o paciente em contexto. Sem modal, validação ou registro aqui (FR-034/FR-037). Offline, não navega.
   */
  changeBed(id: string): void {
    if (this.readOnly()) {
      return;
    }
    if (!this.connectivity.online()) {
      this.offlineNotice.set('Conexão necessária para alterar o leito.');

      return;
    }
    this.offlineNotice.set('');
    void this.router.navigate(['/patients', id, 'change-bed']);
  }

  openPatient(id: string): void {
    void this.router.navigate(['/patients', id]);
  }

  protected bellLabel(): string {
    const count = this.unreadCount();

    return count > 0 ? `Notificações, ${count} não lidas` : 'Notificações';
  }

  /** Tom da barra de meta: crítico <20, alerta <50, na meta; sem dado não há barra. */
  protected goalTone(value: number | null): 'alert' | 'warning' | 'success' | 'none' {
    if (value === null) {
      return 'none';
    }

    if (value < 20) {
      return 'alert';
    }

    return value < 50 ? 'warning' : 'success';
  }

  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) {
      return 'none';
    }

    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  protected therapyLabel(therapy: TherapyType): string {
    return THERAPY_LABEL[therapy];
  }

  protected onVisibility(): void {
    if (refreshesOnVisibility(document.visibilityState)) {
      void this.refresh();
    }
  }

  /** Puxar-para-atualizar: arrasto vertical de mais de 80px a partir do topo da página. */
  protected pullStart(event: TouchEvent): void {
    this.pullFrom = window.scrollY <= 0 ? event.touches[0].clientY : null;
  }

  protected pullEnd(event: TouchEvent): void {
    const from = this.pullFrom;

    this.pullFrom = null;
    if (from !== null && event.changedTouches[0].clientY - from > PULL_THRESHOLD) {
      void this.refresh();
    }
  }

  private setWidth(key: ColumnKey, width: number): void {
    const clamped = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH[key], width)));

    this.widths.update(current => ({ ...current, [key]: clamped }));
    this.fitState.set('needs');
  }
}
