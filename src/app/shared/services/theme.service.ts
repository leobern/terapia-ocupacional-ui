import { Injectable, type Signal, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'conductia-theme';

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme: Theme): void {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/**
 * Tema da aplicação (Light v2 / Dark v2 do Figma). Aplica `data-theme` no `<html>`, que é o
 * que o bloco `:root[data-theme='dark']` de `_tokens.scss` observa. A escolha fica no
 * `localStorage`; sem escolha salva, o padrão é o claro (tema padrão de produção).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme: Signal<Theme>;

  private readonly themeSignal = signal<Theme>(readStoredTheme());

  constructor() {
    this.theme = this.themeSignal.asReadonly();
    applyTheme(this.themeSignal());
  }

  set(theme: Theme): void {
    this.themeSignal.set(theme);
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Armazenamento indisponível (modo privado etc.): o tema vale só nesta sessão.
    }
  }
}
