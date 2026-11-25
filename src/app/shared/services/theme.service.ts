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

/** Cor da barra do navegador no celular: a mesma do fundo (`surface-2` no claro, `surface` no escuro). */
const THEME_COLOR: Readonly<Record<Theme, string>> = { dark: '#0f171a', light: '#f5f7f8' };

function applyTheme(theme: Theme): void {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
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
