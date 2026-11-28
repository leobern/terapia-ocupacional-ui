import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  type OnInit,
  type Signal,
  signal,
} from '@angular/core';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { FieldCardComponent } from '../../shared/components/field-card/field-card.component';
import { AssistantEditorController } from '../../shared/services/assistant-editor-controller.service';
import { FormulaMatch, matchFormulas, splitFormulaNames } from './formula-matcher';
import { Formula } from './formulas.models';

export const REQUEST_MAX_LENGTH = 2000;

/**
 * "Padronizar por lista" (painel lateral): o gestor escreve os nomes que usa, o app procura no catálogo e ele confirma
 * quais padronizar de uma vez. O que não existe vira um pedido de inclusão. Os nomes também podem vir pelo campo de
 * mensagem do rodapé. A busca é por texto (`matchFormulas`), não há IA.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, FieldCardComponent],
  selector: 'app-formula-list-editor',
  styleUrl: './formula-list-editor.component.scss',
  templateUrl: './formula-list-editor.component.html',
})
export class FormulaListEditorComponent implements OnInit {
  /** Catálogo da tela (signal): depois de padronizar, as opções já aparecem marcadas. */
  readonly formulas = input.required<Signal<readonly Formula[]>>();
  /** Padroniza as fórmulas e devolve os nomes das que falharam. */
  readonly standardize = input.required<(ids: readonly string[]) => Promise<readonly string[]>>();
  /** Registra um pedido de inclusão; rejeita se não enviar. */
  readonly request = input.required<(description: string) => Promise<void>>();
  readonly initialText = input('');

  protected readonly text = signal('');
  protected readonly searched = signal('');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly busy = signal(false);
  protected readonly feedback = signal<string | null>(null);
  protected readonly requested = signal(false);

  protected readonly matches = computed<readonly FormulaMatch[]>(() =>
    matchFormulas(this.searched(), this.formulas()()),
  );
  protected readonly missing = computed(() =>
    this.matches()
      .filter(match => match.candidates.length === 0)
      .map(match => match.query),
  );
  protected readonly canSearch = computed(() => splitFormulaNames(this.text()).length > 0);

  constructor() {
    const detach = inject(AssistantEditorController).attach({
      actions: signal([]),
      placeholder: 'Escreva os nomes das fórmulas',
      run: () => undefined,
      send: message => {
        this.text.set(message);
        this.search();
      },
    });

    inject(DestroyRef).onDestroy(detach);
  }

  ngOnInit(): void {
    if (this.initialText()) {
      this.text.set(this.initialText());
      this.search();
    }
  }

  protected search(): void {
    if (!this.canSearch()) {
      return;
    }
    this.feedback.set(null);
    this.requested.set(false);
    this.searched.set(this.text());
    // Só vem marcado o que não deixa dúvida (uma única opção); o resto o gestor escolhe.
    this.selected.set(
      new Set(
        this.matches()
          .filter(match => match.candidates.length === 1 && !match.candidates[0].standardized)
          .map(match => match.candidates[0].id),
      ),
    );
  }

  protected toggle(id: string): void {
    this.selected.update(current => {
      const next = new Set(current);

      if (!next.delete(id)) {
        next.add(id);
      }

      return next;
    });
  }

  protected async apply(): Promise<void> {
    const ids = [...this.selected()];

    if (this.busy() || ids.length === 0) {
      return;
    }
    this.busy.set(true);
    this.feedback.set(null);
    const failed = await this.standardize()(ids);
    const done = ids.length - failed.length;

    this.selected.set(new Set());
    this.feedback.set(
      failed.length === 0
        ? `${done} fórmula(s) padronizada(s) neste hospital.`
        : `${done} padronizada(s). Não foi possível salvar: ${failed.join(', ')}.`,
    );
    this.busy.set(false);
  }

  protected async requestMissing(): Promise<void> {
    if (this.busy() || this.missing().length === 0) {
      return;
    }
    this.busy.set(true);
    this.feedback.set(null);
    const description = `Fórmulas não encontradas no catálogo: ${this.missing().join('; ')}`;

    try {
      await this.request()(description.slice(0, REQUEST_MAX_LENGTH));
      this.requested.set(true);
      this.feedback.set('Pedido de inclusão enviado. Ele aparece em "Pedidos de inclusão", na Farmácia.');
    } catch {
      this.feedback.set('Não foi possível enviar o pedido. Tente novamente.');
    } finally {
      this.busy.set(false);
    }
  }
}
