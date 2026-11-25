import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '../../shared/services/i18n.service';
import { LocalSessionStore } from './local-session-store';
import { LogoutService } from './logout.service';
import { RefreshRejectedError, TokenRefresher } from './token-refresher';

/**
 * Renovação transparente do `accessToken` (US-001-1-08, RN-05). Chamadas simultâneas
 * compartilham uma única renovação. Falha definitiva encerra a sessão pelo mesmo fluxo do
 * logout e leva ao login com a MSG-01; falha de rede só propaga o erro.
 */
@Injectable({ providedIn: 'root' })
export class SessionRenewalService {
  private readonly store = inject(LocalSessionStore);
  private readonly refresher = inject(TokenRefresher);
  private readonly logoutService = inject(LogoutService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private inFlight: Promise<string> | null = null;

  /** Renova e devolve o novo `accessToken`. */
  renew(): Promise<string> {
    this.inFlight ??= this.run().finally(() => (this.inFlight = null));

    return this.inFlight;
  }

  private async run(): Promise<string> {
    const refreshToken = this.store.refreshToken();

    if (refreshToken === null) {
      throw new RefreshRejectedError();
    }

    try {
      const tokens = await this.refresher.refresh(refreshToken);

      this.store.updateTokens(tokens);

      return tokens.accessToken;
    } catch (error) {
      if (error instanceof RefreshRejectedError) {
        await this.endSession();
      }

      throw error;
    }
  }

  private async endSession(): Promise<void> {
    await this.logoutService.logout();
    // replaceUrl: a rota autenticada atual sai do histórico; a MSG-01 segue no `state`.
    await this.router.navigateByUrl('/login', { replaceUrl: true, state: { notice: this.i18n.t('session.expired') } });
  }
}
