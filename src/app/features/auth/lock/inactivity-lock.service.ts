import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

import { LocalSessionStore } from '../local-session-store';

/** RN-02: limite de inatividade (30 minutos). */
export const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

/** Chaves persistidas (fora da allowlist de preferências: apagadas no logout). */
export const BACKGROUNDED_AT_KEY = 'session.backgroundedAt';
export const LOCK_STATE_KEY = 'session.lockState';
export const LOCK_RETURN_URL_KEY = 'session.lockReturnUrl';

export type LockState = 'UNLOCKED' | 'LOCKED';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Armazenamento indisponível: o bloqueio vale só nesta abertura.
  }
}

/**
 * Bloqueio por inatividade (US-001-1-08, RN-01/02/06). A contagem usa o instante em que o
 * app foi para segundo plano, persistido localmente: fechar à força e reabrir não reinicia
 * o prazo, e nada depende de rede. Sem sessão local válida o bloqueio não se aplica.
 */
@Injectable({ providedIn: 'root' })
export class InactivityLockService {
  private readonly store = inject(LocalSessionStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly state = signal<LockState>(read(LOCK_STATE_KEY) === 'LOCKED' ? 'LOCKED' : 'UNLOCKED');
  private started = false;

  /** Estado atual; sem sessão válida é sempre `UNLOCKED`. */
  lockState(): LockState {
    return this.store.isValid() && this.state() === 'LOCKED' ? 'LOCKED' : 'UNLOCKED';
  }

  isLocked(): boolean {
    return this.lockState() === 'LOCKED';
  }

  /** Rota em que o médico estava quando o app bloqueou (retorno após desbloquear). */
  returnUrl(): string {
    return read(LOCK_RETURN_URL_KEY) ?? '/home';
  }

  /** Começa a observar o ciclo de vida da página (segundo plano / primeiro plano). */
  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    const onVisibility = (): void => {
      if (this.document.visibilityState === 'hidden') {
        this.markBackgrounded();
      } else {
        this.resume();
      }
    };
    const onPageHide = (): void => this.markBackgrounded();
    const view = this.document.defaultView;

    this.document.addEventListener('visibilitychange', onVisibility);
    view?.addEventListener('pagehide', onPageHide);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onVisibility);
      view?.removeEventListener('pagehide', onPageHide);
    });
  }

  /** O app foi para segundo plano: persiste o instante. */
  markBackgrounded(now: number = Date.now()): void {
    if (this.store.isValid() && !this.isLocked()) {
      write(BACKGROUNDED_AT_KEY, String(now));
    }
  }

  /**
   * Reabertura: bloqueia quando passaram 30 min ou mais (C2) e leva à `LockScreen`;
   * abaixo disso nada muda e a tela atual permanece (C1). Devolve o estado resultante.
   */
  evaluate(now: number = Date.now()): LockState {
    if (!this.store.isValid()) {
      return 'UNLOCKED';
    }

    const stamp = Number(read(BACKGROUNDED_AT_KEY));

    if (!this.isLocked() && stamp > 0 && now - stamp >= INACTIVITY_LIMIT_MS) {
      write(LOCK_RETURN_URL_KEY, this.currentUrl());
      write(LOCK_STATE_KEY, 'LOCKED');
      this.state.set('LOCKED');
    } else if (!this.isLocked()) {
      write(BACKGROUNDED_AT_KEY, null);
    }

    return this.lockState();
  }

  /** Volta ao primeiro plano: avalia e, se bloqueou, exibe a LockScreen. */
  resume(now: number = Date.now()): void {
    if (this.evaluate(now) === 'LOCKED' && !this.router.url.startsWith('/lock')) {
      void this.router.navigateByUrl('/lock', { replaceUrl: true });
    }
  }

  /** Desbloqueio concluído: libera o app e zera o prazo. */
  unlock(): void {
    this.state.set('UNLOCKED');
    write(LOCK_STATE_KEY, null);
    write(BACKGROUNDED_AT_KEY, null);
    write(LOCK_RETURN_URL_KEY, null);
  }

  private currentUrl(): string {
    const url = this.router.url;

    return url === '' || url === '/' || url.startsWith('/lock') || url.startsWith('/splash') ? '/home' : url;
  }
}
