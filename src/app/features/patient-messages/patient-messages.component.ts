import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { InputChatAudioError, InputChatComponent } from '../../shared/components/input-chat/input-chat.component';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import {
  formatDateTime,
  isThreadParticipant,
  isOverdue,
  MessageThread,
  REPLY_AUDIO_EMPTY_HINT,
  REPLY_AUDIO_FAILED_HINT,
  REPLY_FAILED_HINT,
  REPLY_MIC_DENIED_HINT,
  REPLY_MIC_FAILED_HINT,
  REPLY_OFFLINE_HINT,
  RESOLVE_FAILED_HINT,
  RESOLVE_OFFLINE_HINT,
  ReplyOrigin,
  THREADS_EMPTY_TEXT,
  THREADS_LOAD_FAILED_HINT,
} from './patient-messages.models';
import { PatientMessagesSource, PatientMessagesWriter, ReplyTranscriber } from './patient-messages-source';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Mensagens do paciente no Hub (FT-005-1, US-005-1-02): um card por thread, visível a qualquer profissional
 * vinculado e aprovado (inclusive quem não foi mencionado), com resposta por texto ou áudio transcrito sem
 * passar pelo assistente de IA. Sem desenho no Figma: desenho do agente com componentes v2 existentes.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ConfirmDialogComponent, InputChatComponent],
  selector: 'app-patient-threads',
  styleUrl: './patient-messages.component.scss',
  templateUrl: './patient-messages.component.html',
})
export class PatientThreadsComponent implements OnInit {
  readonly patientId = input.required<string>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly threads = signal<readonly MessageThread[]>([]);
  /** Rascunhos de resposta por thread (preservados em caso de falha). */
  protected readonly drafts = signal<Readonly<Record<string, string>>>({});
  protected readonly origins = signal<Readonly<Record<string, ReplyOrigin>>>({});
  protected readonly notices = signal<Readonly<Record<string, string>>>({});
  protected readonly sendingId = signal<string | null>(null);
  protected readonly transcribingId = signal<string | null>(null);
  /** Thread aguardando a confirmação de "Resolver" (null = diálogo fechado). */
  protected readonly resolveConfirmId = signal<string | null>(null);
  protected readonly resolveNotices = signal<Readonly<Record<string, string>>>({});
  protected readonly resolveOfflineHint = RESOLVE_OFFLINE_HINT;
  protected readonly connectivity = inject(ConnectivityService);
  protected readonly loadFailedHint = THREADS_LOAD_FAILED_HINT;
  protected readonly emptyText = THREADS_EMPTY_TEXT;
  protected readonly offlineHint = REPLY_OFFLINE_HINT;
  protected readonly ordered = computed(() =>
    [...this.threads()].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
  );

  private readonly source = inject(PatientMessagesSource);
  private readonly writer = inject(PatientMessagesWriter);
  private readonly transcriber = inject(ReplyTranscriber);
  private readonly profile = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);

  ngOnInit(): void {
    void this.load();
  }

  /** Falha com threads já carregadas (ex.: offline) mantém o que está na tela. */
  protected async load(): Promise<void> {
    if (this.threads().length === 0) {
      this.state.set('loading');
    }
    try {
      this.threads.set(await this.source.list(this.patientId()));
      this.state.set('ready');
    } catch {
      this.state.set(this.threads().length > 0 ? 'ready' : 'error');
    }
  }

  protected draft(id: string): string {
    return this.drafts()[id] ?? '';
  }

  protected canSend(id: string): boolean {
    return this.connectivity.online() && this.sendingId() === null && this.draft(id).trim() !== '';
  }

  protected onDraft(id: string, event: Event): void {
    this.drafts.update(d => ({ ...d, [id]: (event.target as HTMLTextAreaElement).value }));
    this.origins.update(o => ({ ...o, [id]: 'text' }));
  }

  protected overdue(thread: MessageThread): boolean {
    return isOverdue(thread, this.now());
  }

  protected stamp(author: string, at: string): string {
    return `${author} · ${formatDateTime(at)}`;
  }

  protected statusLabel(thread: MessageThread): string {
    return thread.resolved ? 'Resolvida' : 'Ativa';
  }

  protected canResolve(thread: MessageThread): boolean {
    return !thread.resolved && isThreadParticipant(thread, this.profile.read().name);
  }

  protected onResolveClick(thread: MessageThread): void {
    if (this.connectivity.online() && this.canResolve(thread)) {
      this.resolveConfirmId.set(thread.id);
    }
  }

  protected onCancelResolve(): void {
    this.resolveConfirmId.set(null);
  }

  /** "Sim": grava a resolução; se falhar, a thread continua ativa e o erro aparece em texto. */
  protected async onConfirmResolve(): Promise<void> {
    const id = this.resolveConfirmId();
    const thread = this.threads().find(t => t.id === id);

    this.resolveConfirmId.set(null);
    if (thread === undefined || !this.connectivity.online() || !this.canResolve(thread)) {
      return;
    }
    this.setResolveNotice(thread.id, null);
    try {
      const updated = await this.writer.resolve({
        at: this.now().toISOString(),
        author: this.profile.read().name,
        threadId: thread.id,
      });

      this.threads.update(list => list.map(t => (t.id === updated.id ? updated : t)));
    } catch {
      this.setResolveNotice(thread.id, RESOLVE_FAILED_HINT);
    }
  }

  protected async send(thread: MessageThread): Promise<void> {
    if (!this.canSend(thread.id)) {
      return;
    }
    this.sendingId.set(thread.id);
    this.setNotice(thread.id, null);
    try {
      const updated = await this.writer.reply({
        at: this.now().toISOString(),
        author: this.profile.read().name,
        origin: this.origins()[thread.id] ?? 'text',
        text: this.draft(thread.id).trim(),
        threadId: thread.id,
      });

      this.threads.update(list => list.map(t => (t.id === updated.id ? updated : t)));
      this.drafts.update(d => ({ ...d, [thread.id]: '' }));
      this.origins.update(o => ({ ...o, [thread.id]: 'text' }));
    } catch {
      this.setNotice(thread.id, REPLY_FAILED_HINT);
    } finally {
      this.sendingId.set(null);
    }
  }

  /** Áudio gravado: vira texto transcrito e editável no campo; nunca envia sozinho. */
  protected async onAudio(thread: MessageThread, audio: Blob): Promise<void> {
    if (!this.connectivity.online() || this.transcribingId() !== null) {
      return;
    }
    this.setNotice(thread.id, null);
    this.transcribingId.set(thread.id);
    try {
      const text = (await this.transcriber.transcribe(audio)).trim();

      if (text === '') {
        this.setNotice(thread.id, REPLY_AUDIO_EMPTY_HINT);

        return;
      }
      this.drafts.update(d => ({ ...d, [thread.id]: text }));
      this.origins.update(o => ({ ...o, [thread.id]: 'audio' }));
    } catch {
      this.setNotice(thread.id, REPLY_AUDIO_FAILED_HINT);
    } finally {
      this.transcribingId.set(null);
    }
  }

  protected onAudioError(thread: MessageThread, reason: InputChatAudioError): void {
    this.setNotice(thread.id, reason === 'permission-denied' ? REPLY_MIC_DENIED_HINT : REPLY_MIC_FAILED_HINT);
  }

  private setResolveNotice(id: string, message: string | null): void {
    this.resolveNotices.update(n => {
      const rest = Object.fromEntries(Object.entries(n).filter(([key]) => key !== id));

      return message === null ? rest : { ...rest, [id]: message };
    });
  }

  private setNotice(id: string, message: string | null): void {
    this.notices.update(n => {
      const rest = Object.fromEntries(Object.entries(n).filter(([key]) => key !== id));

      return message === null ? rest : { ...rest, [id]: message };
    });
  }
}
