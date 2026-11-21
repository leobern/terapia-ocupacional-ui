import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';

import { ButtonComponent } from '../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import {
  activeClosures,
  buildHistory,
  FollowUpClosure,
  FollowUpHistoryEntry,
  FollowUpReopening,
  formatIsoDate,
  OFFLINE_REOPEN_HINT,
  reasonLabel,
  REOPEN_FAILED_HINT,
} from './follow-up-closure.models';
import { FollowUpClosureSource, FollowUpClosureWriter } from './follow-up-closure-source';

const dateTime = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');

  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Acompanhamento encerrado no Hub (FT-004-9, US-004-9-02): ação de reabrir (com confirmação explícita) e
 * histórico de encerramentos e reaberturas. Desenho do Figma ainda inexistente para esta parte: reaproveita
 * os componentes v2 (card, botão, diálogo) e os tokens do Hub.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ConfirmDialogComponent],
  selector: 'app-follow-up-status',
  styleUrl: './follow-up-status.component.scss',
  templateUrl: './follow-up-status.component.html',
})
export class FollowUpStatusComponent implements OnInit {
  readonly patientId = input.required<string>();
  /** Só profissional com vínculo hospitalar aprovado em contexto pode reabrir (FR-014); qualquer perfil. */
  readonly canReopen = input(false);
  /** Reabertura gravada: quem hospeda a tela pode atualizar o que depender do estado. */
  readonly reopened = output<FollowUpReopening>();

  protected readonly closures = signal<readonly FollowUpClosure[]>([]);
  protected readonly reopenings = signal<readonly FollowUpReopening[]>([]);
  protected readonly history = computed(() => buildHistory(this.closures(), this.reopenings()));
  protected readonly current = computed(() => activeClosures(this.closures(), this.reopenings()).at(-1) ?? null);
  protected readonly confirmOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly hint = signal<string | null>(null);

  private readonly source = inject(FollowUpClosureSource);
  private readonly writer = inject(FollowUpClosureWriter);
  private readonly connectivity = inject(ConnectivityService);
  private readonly professional = inject(ProfessionalProfileReader);
  private readonly now = inject(NOW);

  ngOnInit(): void {
    void this.load();
  }

  /** A leitura vem do cache local quando offline; se falhar, a seção simplesmente não aparece. */
  protected async load(): Promise<void> {
    try {
      const id = this.patientId();
      const [closures, reopenings] = await Promise.all([this.source.list(id), this.source.listReopenings(id)]);

      this.closures.set(closures);
      this.reopenings.set(reopenings);
    } catch {
      // mantém o que já está exibido
    }
  }

  protected askReopen(): void {
    if (!this.connectivity.online()) {
      this.hint.set(OFFLINE_REOPEN_HINT);

      return;
    }
    this.hint.set(null);
    this.confirmOpen.set(true);
  }

  protected cancelReopen(): void {
    this.confirmOpen.set(false);
  }

  protected async confirmReopen(): Promise<void> {
    const closure = this.current();

    if (closure === null || this.saving()) {
      return;
    }
    if (!this.connectivity.online()) {
      this.confirmOpen.set(false);
      this.hint.set(OFFLINE_REOPEN_HINT);

      return;
    }
    this.saving.set(true);
    try {
      const reopening = await this.writer.reopen({
        at: this.now().toISOString(),
        author: this.professional.read().name,
        closureId: closure.id,
        patientId: this.patientId(),
      });

      this.reopenings.update(list => [...list, reopening]);
      this.hint.set(null);
      this.reopened.emit(reopening);
    } catch {
      this.hint.set(REOPEN_FAILED_HINT);
    } finally {
      this.saving.set(false);
      this.confirmOpen.set(false);
    }
  }

  protected closureLabel(closure: FollowUpClosure): string {
    return `${reasonLabel(closure.reason)} em ${formatIsoDate(closure.effectiveDate)}`;
  }

  protected closureText(entry: FollowUpHistoryEntry & { kind: 'closure' }): string {
    const { closure } = entry;

    return `${reasonLabel(closure.reason)} · efeito em ${formatIsoDate(closure.effectiveDate)}`;
  }

  protected stamp(author: string, at: string): string {
    return `${author} · ${dateTime(at)}`;
  }

  protected revertedText(reopening: FollowUpReopening): string {
    return `Revertido por reabertura em ${dateTime(reopening.at)}`;
  }
}
