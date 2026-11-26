import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { NetworkStateService } from '../../offline/network-state.service';
import { OutboxOperation } from '../../offline/offline-store';
import { OutboxService } from '../../offline/outbox.service';
import { OutboxSyncService } from '../../offline/outbox-sync.service';
import { previewText, summaryText, SYNC_STATUS_LABEL, SYNC_TYPE_LABEL } from '../../offline/sync-labels';
import { ViewportBreakpointService } from '../../services/viewport-breakpoint.service';
import { BottomSheetComponent } from '../bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '../button/button.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../drawer/drawer.component';

/** "26/11 às 10:05" a partir de um ISO, no fuso local. */
export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');

  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Indicador do modo offline (ADR-003): um selo fixo com o contador de gravações pendentes, com falha ou em conflito, e o
 * aviso "Sem conexão" / "dados de dd/mm às hh:mm" quando a tela mostra a cópia local. Tocar abre a lista (sidebar no
 * desktop, bottom sheet no celular) com o estado de cada gravação, "Tentar de novo", "Descartar" e a escolha entre as
 * versões de um texto em conflito. Montado só com superfícies do design system; sem desenho validado no Figma.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BottomSheetComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    NgTemplateOutlet,
    PhIconComponent,
  ],
  selector: 'app-sync-status',
  styleUrl: './sync-status.component.scss',
  templateUrl: './sync-status.component.html',
})
export class SyncStatusComponent {
  protected readonly outbox = inject(OutboxService);
  protected readonly network = inject(NetworkStateService);
  protected readonly viewport = inject(ViewportBreakpointService);
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly statusLabel = SYNC_STATUS_LABEL;
  protected readonly typeLabel = SYNC_TYPE_LABEL;
  protected readonly format = shortDateTime;
  protected readonly preview = previewText;
  /** Gravação aguardando a confirmação de descarte (o texto digitado se perde de vez). */
  protected readonly discarding = signal<OutboxOperation | null>(null);

  protected readonly summary = computed(() =>
    summaryText({
      conflict: this.outbox.conflictCount(),
      failed: this.outbox.failedCount(),
      pending: this.outbox.pendingCount(),
    }),
  );
  /** Aviso de rede: sem conexão (a tela pode estar mostrando a cópia local, com a hora dela). */
  protected readonly networkText = computed(() => {
    const stale = this.network.staleSavedAt();

    if (stale !== null) {
      // Com a rede de volta a tela ainda mostra a cópia local até ser lida de novo.
      return this.network.reachable()
        ? `Dados de ${shortDateTime(stale)} (cópia local)`
        : `Sem conexão · dados de ${shortDateTime(stale)}`;
    }

    return this.network.reachable() ? '' : 'Sem conexão';
  });
  protected readonly chipText = computed(() => [this.networkText(), this.summary()].filter(Boolean).join(' · '));
  protected readonly visible = computed(() => this.summary() !== '' || this.networkText() !== '');
  protected readonly hasAttention = computed(() => this.outbox.failedCount() > 0 || this.outbox.conflictCount() > 0);

  private readonly sync = inject(OutboxSyncService);

  protected toggle(): void {
    this.open.update(value => !value);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected async syncNow(): Promise<void> {
    this.busy.set(true);
    try {
      await this.sync.drain(true);
    } finally {
      this.busy.set(false);
    }
  }

  protected async retry(operation: OutboxOperation): Promise<void> {
    await this.outbox.retry(operation.opId);
    await this.sync.drain(true);
  }

  protected askDiscard(operation: OutboxOperation): void {
    this.discarding.set(operation);
  }

  protected cancelDiscard(): void {
    this.discarding.set(null);
  }

  protected async confirmDiscard(): Promise<void> {
    const operation = this.discarding();

    this.discarding.set(null);
    if (operation !== null) {
      await this.outbox.remove(operation.opId);
    }
  }

  /** O profissional escolheu o texto que fica (a sua ou a de outro): grava como versão nova e reenvia. */
  protected async keep(operation: OutboxOperation, text: string): Promise<void> {
    await this.outbox.resolveConflict(operation.opId, text);
    await this.sync.drain(true);
  }
}
