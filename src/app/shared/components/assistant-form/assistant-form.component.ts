import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';

import { AutoResizeTextareaDirective } from '../../directives/auto-resize-textarea.directive';
import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { AssistantFormController } from '../../services/assistant-form-controller.service';
import {
  type FormActionDefinition,
  type FormFieldDefinition,
  type FormValues,
} from '../../services/screen-actions.service';
import { type DirectoryUser, UserDirectory } from '../../services/user-directory';
import { AccordionComponent, type AccordionState } from '../accordion/accordion.component';
import { AvatarComponent } from '../avatar/avatar.component';
import { ButtonComponent } from '../button/button.component';

/** `@` seguido de letras no FIM do texto: o trecho que o autocomplete está completando. */
const MENTION_TOKEN = /@([^\s@]*)$/u;

/**
 * Formulário em cards do assistente (padrão de cadastro — docs/regras-de-negocio/
 * padrao-de-cadastro.md): um `app-accordion` por pergunta, montado a partir de uma
 * `FormActionDefinition`. Campos suportados: `mention` (`@` abre o autocomplete de
 * usuários cadastrados e vira chips), `text` e `date`. Todos os cards começam abertos;
 * fechar um card com valor o resume ("preenchido"), sem valor ele fica "vazio".
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccordionComponent, AutoResizeTextareaDirective, AvatarComponent, ButtonComponent, PhIconComponent],
  selector: 'app-assistant-form',
  styleUrl: './assistant-form.component.scss',
  templateUrl: './assistant-form.component.html',
})
export class AssistantFormComponent {
  readonly definition = input.required<FormActionDefinition>();
  /** Emitido depois que `definition.submit` conclui sem erro. */
  readonly submitted = output();

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly suggestionsFor = signal<string | null>(null);
  protected readonly suggestions = signal<readonly DirectoryUser[]>([]);
  /** Data mínima do campo `date`: hoje (não faz sentido resolver no passado). */
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly canSubmit = computed(
    () => !this.submitting() && this.definition().fields.every(field => !field.required || this.hasValue(field)),
  );

  private readonly directory = inject(UserDirectory);
  private readonly controller = inject(AssistantFormController);
  private readonly texts = signal<Readonly<Record<string, string>>>({});
  private readonly mentions = signal<Readonly<Record<string, readonly DirectoryUser[]>>>({});
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());
  /** Descarta respostas de busca que chegam depois de uma digitação mais nova. */
  private searchToken = 0;

  constructor() {
    // O rodapé do painel (sugestões + mensagem/áudio) aciona o preenchimento por IA através do controlador.
    inject(DestroyRef).onDestroy(
      this.controller.attach({
        apply: values => this.apply(values),
        definition: this.definition,
      }),
    );
  }

  /** Aplica valores vindos da IA: só os campos conhecidos; o usuário revisa e envia. */
  apply(values: FormValues): void {
    for (const field of this.definition().fields) {
      if (!(field.id in values)) {
        continue;
      }
      const value = values[field.id];

      if (field.kind === 'mention' && typeof value !== 'string') {
        this.mentions.update(current => ({ ...current, [field.id]: value }));
      } else if (typeof value === 'string') {
        this.texts.update(current => ({ ...current, [field.id]: value }));
      }
    }
    this.errorMessage.set(null);
  }

  /** Botão de envio, que só aparece com todas as perguntas obrigatórias respondidas. */
  async onSubmit(): Promise<void> {
    if (!this.canSubmit()) {
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.definition().submit(this.values());
      this.reset();
      this.submitted.emit();
    } catch {
      this.errorMessage.set('Não foi possível salvar. Tente novamente.');
    } finally {
      this.submitting.set(false);
    }
  }

  protected state(field: FormFieldDefinition): AccordionState {
    if (!this.collapsed().has(field.id)) {
      return 'expanded';
    }

    return this.hasValue(field) ? 'collapsed-filled' : 'collapsed-empty';
  }

  protected toggle(field: FormFieldDefinition): void {
    this.collapsed.update(current => {
      const next = new Set(current);

      if (next.has(field.id)) {
        next.delete(field.id);
      } else {
        next.add(field.id);
      }

      return next;
    });
  }

  protected text(field: FormFieldDefinition): string {
    return this.texts()[field.id] ?? '';
  }

  protected selected(field: FormFieldDefinition): readonly DirectoryUser[] {
    return this.mentions()[field.id] ?? [];
  }

  protected onText(field: FormFieldDefinition, value: string): void {
    this.texts.update(current => ({ ...current, [field.id]: value }));
    this.errorMessage.set(null);
  }

  /** Digitação do campo `mention`: `@` + letras abre/filtra a lista de usuários. */
  protected onMentionInput(field: FormFieldDefinition, value: string): void {
    this.onText(field, value);
    const token = MENTION_TOKEN.exec(value);

    if (!token) {
      this.closeSuggestions();

      return;
    }
    const current = ++this.searchToken;

    this.suggestionsFor.set(field.id);
    void this.directory.search(token[1]).then(users => {
      if (current === this.searchToken) {
        const picked = new Set(this.selected(field).map(user => user.id));

        this.suggestions.set(users.filter(user => !picked.has(user.id)));
      }
    });
  }

  protected pick(field: FormFieldDefinition, user: DirectoryUser): void {
    this.mentions.update(current => ({ ...current, [field.id]: [...(current[field.id] ?? []), user] }));
    this.onText(field, this.text(field).replace(MENTION_TOKEN, '').trimEnd());
    this.closeSuggestions();
  }

  protected remove(field: FormFieldDefinition, user: DirectoryUser): void {
    this.mentions.update(current => ({
      ...current,
      [field.id]: (current[field.id] ?? []).filter(u => u.id !== user.id),
    }));
  }

  protected formatDate(iso: string): string {
    const [year, month, day] = iso.split('-');

    return `${day}/${month}/${year}`;
  }

  private hasValue(field: FormFieldDefinition): boolean {
    return field.kind === 'mention' ? this.selected(field).length > 0 : this.text(field).trim() !== '';
  }

  private values(): FormValues {
    return Object.fromEntries(
      this.definition().fields.map(field => [
        field.id,
        field.kind === 'mention' ? this.selected(field) : this.text(field).trim(),
      ]),
    );
  }

  private closeSuggestions(): void {
    this.searchToken++;
    this.suggestionsFor.set(null);
    this.suggestions.set([]);
  }

  private reset(): void {
    this.texts.set({});
    this.mentions.set({});
    this.collapsed.set(new Set());
    this.closeSuggestions();
  }
}
