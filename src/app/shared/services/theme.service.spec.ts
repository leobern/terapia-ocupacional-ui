import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.removeItem('conductia-theme');
    document.documentElement.removeAttribute('data-theme');
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    localStorage.removeItem('conductia-theme');
    document.documentElement.removeAttribute('data-theme');
  });

  it('começa no tema claro, sem data-theme', () => {
    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('light');
    expect(document.documentElement.hasAttribute('data-theme')).toBeFalse();
  });

  it('aplica data-theme="dark" e persiste a escolha', () => {
    const service = TestBed.inject(ThemeService);

    service.set('dark');

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('conductia-theme')).toBe('dark');
  });

  it('volta ao claro removendo data-theme', () => {
    const service = TestBed.inject(ThemeService);

    service.set('dark');

    service.set('light');

    expect(document.documentElement.hasAttribute('data-theme')).toBeFalse();
  });

  it('restaura o tema escuro salvo ao iniciar', () => {
    localStorage.setItem('conductia-theme', 'dark');

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
