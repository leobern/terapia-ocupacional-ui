import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/**
 * Tela de privacidade (US-001-1-08, RN-03). Sinaliza quando o app está em segundo plano ou
 * sem foco, para o overlay opaco cobrir o conteúdo no seletor de apps do SO. Na web só há
 * os eventos de visibilidade/foco da página; um shell nativo pode precisar de configuração
 * própria (ex.: `FLAG_SECURE` no Android).
 */
@Injectable({ providedIn: 'root' })
export class PrivacyOverlayService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly covered = signal(this.document.visibilityState === 'hidden');
  private started = false;

  /** `true` enquanto o conteúdo deve ficar coberto. */
  visible(): boolean {
    return this.covered();
  }

  /** Passa a observar a página (idempotente; remove os ouvintes ao destruir). */
  start(): void {
    const view = this.document.defaultView;

    if (this.started || !view) {
      return;
    }

    this.started = true;
    const cover = (): void => this.covered.set(true);
    const uncover = (): void => this.covered.set(this.document.visibilityState === 'hidden');
    const onVisibility = (): void => (this.document.visibilityState === 'hidden' ? cover() : uncover());

    this.document.addEventListener('visibilitychange', onVisibility);
    view.addEventListener('pagehide', cover);
    view.addEventListener('blur', cover);
    view.addEventListener('pageshow', uncover);
    view.addEventListener('focus', uncover);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onVisibility);
      view.removeEventListener('pagehide', cover);
      view.removeEventListener('blur', cover);
      view.removeEventListener('pageshow', uncover);
      view.removeEventListener('focus', uncover);
    });
  }
}
