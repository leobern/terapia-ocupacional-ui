import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { PhIconComponent } from '../../../shared/icons/ph-icon/ph-icon.component';
import { InputChatAudioError, InputChatComponent } from '../../../shared/components/input-chat/input-chat.component';
import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { DailyEvolutionSource } from './daily-evolution-source';
import { EvolutionAiStructurer } from './evolution-ai-structurer';
import { DailyEvolution, dayKey, EvolutionOrigin, registeredAt } from './daily-record.models';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export const EVOLUTION_LOAD_FAILED_HINT = 'Não foi possível carregar a evolução do dia. Tente novamente em instantes.';
export const EVOLUTION_SAVE_FAILED_HINT = 'Não foi possível salvar a evolução. O texto foi mantido; tente novamente.';
export const EVOLUTION_OFFLINE_HINT =
  'Sem conexão: o salvamento no servidor fica pendente até haver conexão. Você pode continuar digitando.';
export const EVOLUTION_EMPTY_TEXT = 'Nenhuma evolução médica registrada hoje.';
export const EVOLUTION_AI_UNAVAILABLE_HINT = 'Registro por IA indisponível sem conexão. Digite a evolução manualmente.';
export const EVOLUTION_AI_FAILED_HINT =
  'Não foi possível gerar o texto por IA. Digite a evolução manualmente ou tente de novo.';
export const EVOLUTION_AI_EMPTY_HINT =
  'A IA não identificou texto no áudio. Digite a evolução manualmente ou grave de novo.';
export const EVOLUTION_MIC_DENIED_HINT =
  'Sem acesso ao microfone. Digite manualmente ou permita o microfone e tente de novo.';
export const EVOLUTION_MIC_FAILED_HINT = 'Não foi possível gravar o áudio. Digite manualmente ou tente de novo.';
export const EVOLUTION_AI_PROCESSING_HINT = 'Processando o áudio…';
export const EVOLUTION_AI_REVIEW_NOTE = 'Texto sugerido pela IA. Revise e confirme para registrar a evolução.';
export const EVOLUTION_HELP = 'Só médico registra. Texto da IA vem marcado e só salva ao confirmar.';

/**
 * Seção "Evolução médica" do Registro diário (FT-004-7, US-004-7-04), Figma 4717-9855 (desenhado pelo agente),
 * renderizada dentro do bottom sheet. Só o médico registra/edita; os demais perfis só consultam. A evolução
 * só muda por salvamento explícito (o texto da IA só vale após "Confirmar evolução").
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, InputChatComponent, PhIconComponent],
  selector: 'app-daily-evolution',
  styleUrl: './daily-evolution.component.scss',
  templateUrl: './daily-evolution.component.html',
})
export class DailyEvolutionComponent {
  readonly patientId = input.required<string>();
  /** Aberto = o Registro diário está visível; a evolução do dia é lida a cada abertura. */
  readonly open = input(false);

  protected readonly state = signal<LoadState>('idle');
  protected readonly saved = signal<DailyEvolution | null>(null);
  protected readonly draft = signal('');
  protected readonly saving = signal(false);
  /** Texto sugerido pela IA em revisão (`null` = sem sugestão); só vale após confirmação. */
  protected readonly suggestion = signal<string | null>(null);
  protected readonly aiProcessing = signal(false);
  protected readonly aiNotice = signal<string | null>(null);
  protected readonly aiUnavailableHint = EVOLUTION_AI_UNAVAILABLE_HINT;
  protected readonly aiProcessingHint = EVOLUTION_AI_PROCESSING_HINT;
  protected readonly aiReviewNote = EVOLUTION_AI_REVIEW_NOTE;
  protected readonly saveFailed = signal(false);
  protected readonly connectivity = inject(ConnectivityService);
  protected readonly isDoctor = inject(ProfessionalProfileReader).read().role === 'doctor';
  protected readonly loadFailedHint = EVOLUTION_LOAD_FAILED_HINT;
  protected readonly saveFailedHint = EVOLUTION_SAVE_FAILED_HINT;
  protected readonly offlineHint = EVOLUTION_OFFLINE_HINT;
  protected readonly emptyText = EVOLUTION_EMPTY_TEXT;
  protected readonly help = EVOLUTION_HELP;
  protected readonly registeredText = computed(() => {
    const s = this.saved();

    return s === null ? '' : `Registrada por ${s.author} · ${registeredAt(s.at)}`;
  });
  protected readonly canSave = computed(
    () => this.isDoctor && !this.saving() && this.connectivity.online() && this.draft().trim() !== '',
  );

  private readonly source = inject(DailyEvolutionSource);
  private readonly structurer = inject(EvolutionAiStructurer);
  /** Texto que estava no campo antes da sugestão, restaurado ao descartar. */
  private previousDraft = '';
  private readonly profile = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);
  private readonly touched = signal(false);
  /** Descarta respostas de uma abertura anterior (fechar e reabrir rápido, ou troca de paciente). */
  private token = 0;

  constructor() {
    effect(() => {
      if (this.open()) {
        const id = this.patientId();

        untracked(() => void this.load(id));
      } else {
        // Fechou: respostas pendentes de uma abertura anterior são descartadas.
        untracked(() => this.token++);
      }
    });
  }

  protected onDraft(event: Event): void {
    this.touched.set(true);
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  /** Áudio gravado: a IA sugere o texto no campo, marcado "gerado por IA"; nunca salva. */
  protected async onAudio(audio: Blob): Promise<void> {
    if (!this.isDoctor || !this.connectivity.online() || this.aiProcessing()) {
      return;
    }
    const token = this.token;

    this.aiNotice.set(null);
    this.aiProcessing.set(true);
    try {
      const text = (await this.structurer.suggest(audio)).trim();

      // Fechou/reabriu, ou a conexão caiu: descarta só o áudio, sem tocar no campo.
      if (token !== this.token || !this.connectivity.online()) {
        if (token === this.token) {
          this.aiNotice.set(EVOLUTION_AI_FAILED_HINT);
        }

        return;
      }
      if (text === '') {
        this.aiNotice.set(EVOLUTION_AI_EMPTY_HINT);

        return;
      }
      if (this.suggestion() === null) {
        this.previousDraft = this.draft();
      }
      this.suggestion.set(text);
      this.draft.set(text);
      this.touched.set(true);
    } catch {
      if (token === this.token) {
        this.aiNotice.set(EVOLUTION_AI_FAILED_HINT);
      }
    } finally {
      if (token === this.token) {
        this.aiProcessing.set(false);
      }
    }
  }

  protected onAudioError(reason: InputChatAudioError): void {
    this.aiNotice.set(reason === 'permission-denied' ? EVOLUTION_MIC_DENIED_HINT : EVOLUTION_MIC_FAILED_HINT);
  }

  /** Descarta a sugestão: a evolução vigente e o texto anterior do campo ficam como estavam. */
  protected discard(): void {
    this.suggestion.set(null);
    this.draft.set(this.previousDraft);
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    const token = this.token;
    const at = this.now();

    this.saving.set(true);
    this.saveFailed.set(false);
    try {
      const saved = await this.source.save({
        at: at.toISOString(),
        author: this.profile.read().name,
        day: dayKey(at),
        origin: this.origin(),
        patientId: this.patientId(),
        text: this.draft().trim(),
      });

      if (token === this.token) {
        this.saved.set(saved);
        this.draft.set(saved.text);
        this.suggestion.set(null);
        this.touched.set(false);
      }
    } catch {
      if (token === this.token) {
        this.saveFailed.set(true);
      }
    } finally {
      this.saving.set(false);
    }
  }

  private origin(): EvolutionOrigin {
    const suggested = this.suggestion();

    if (suggested === null) {
      return 'manual';
    }

    return this.draft().trim() === suggested ? 'ai' : 'ai-edited';
  }

  private async load(patientId: string): Promise<void> {
    const token = ++this.token;

    this.state.set('loading');
    this.saved.set(null);
    this.draft.set('');
    this.touched.set(false);
    this.saveFailed.set(false);
    this.suggestion.set(null);
    this.aiNotice.set(null);
    this.aiProcessing.set(false);
    try {
      const current = await this.source.load(patientId, dayKey(this.now()));

      if (token !== this.token) {
        return;
      }
      this.saved.set(current);
      // Offline ou digitação já iniciada: nunca sobrescreve o que o médico escreveu.
      if (!this.touched()) {
        this.draft.set(current?.text ?? '');
      }
      this.state.set('ready');
    } catch {
      if (token === this.token) {
        // Falha na leitura não bloqueia o registro manual (Princípio VI).
        this.state.set('error');
      }
    }
  }
}
