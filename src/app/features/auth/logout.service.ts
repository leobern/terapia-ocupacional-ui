import { inject, Injectable } from '@angular/core';

import { OfflineStore } from '../../shared/offline/offline-store';
import { OfflineUserService } from '../../shared/offline/offline-user.service';
import { OutboxService } from '../../shared/offline/outbox.service';
import { LocalSessionStore } from './local-session-store';
import { SessionRevoker } from './session-revoker';

async function purgeReadCache(offline: OfflineStore, userId: string | null): Promise<void> {
  try {
    if (userId !== null) {
      await offline.clearCache(userId);
    }
  } catch {
    // Armazenamento local indisponível: não impede o logout.
  }
}

/**
 * Encerra a sessão do dispositivo ATUAL e limpa o cache sensível local (RN02, RN03). O cache de leitura do modo offline
 * (ADR-003) é apagado junto. A fila de escrita pendente NÃO é descartada em silêncio: fica guardada, separada por
 * usuário, e só é enviada quando a mesma conta entrar de novo (pendência de produto: expurgo, ver ADR-003). O logout
 * voluntário pede confirmação mostrando quantas gravações estão pendentes.
 */
@Injectable({ providedIn: 'root' })
export class LogoutService {
  private readonly revoker = inject(SessionRevoker);
  private readonly store = inject(LocalSessionStore);
  private readonly users = inject(OfflineUserService);
  private readonly offline = inject(OfflineStore);
  private readonly outbox = inject(OutboxService);

  async logout(): Promise<void> {
    // O usuário sai do token: captura antes de limpar a sessão.
    const userId = this.users.userId();

    try {
      await this.revoker.revokeCurrentDevice();
    } catch {
      // Sem rede ou erro remoto: a sessão local termina mesmo assim.
    } finally {
      this.store.clear();
      // A fila fica guardada no aparelho, mas a tela não pode mostrá-la a quem entrar depois.
      this.outbox.operations.set([]);
      await purgeReadCache(this.offline, userId);
    }
  }
}
