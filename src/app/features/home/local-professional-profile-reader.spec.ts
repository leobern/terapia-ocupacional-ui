import { TestBed } from '@angular/core/testing';

import { LocalSessionStore } from '../auth/local-session-store';
import { LocalProfessionalProfileReader } from './local-professional-profile-reader';

describe('LocalProfessionalProfileReader', () => {
  let reader: LocalProfessionalProfileReader;
  let store: LocalSessionStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [LocalProfessionalProfileReader] });
    reader = TestBed.inject(LocalProfessionalProfileReader);
    store = TestBed.inject(LocalSessionStore);
  });

  afterEach(() => localStorage.clear());

  it('usa o nome do token da sessão (com acentos)', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ nomeCompleto: 'Almira Conceição' }));
    const payload = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));

    store.open({ accessToken: `h.${payload}.s`, refreshToken: 'r' });

    expect(reader.read()).toEqual({ name: 'Almira Conceição', role: 'doctor' });
  });

  it('lê o id do usuário (claim usuarioId) quando há', () => {
    const payload = btoa(JSON.stringify({ nomeCompleto: 'Ana', usuarioId: 42 }));

    store.open({ accessToken: 'h.' + payload + '.s', refreshToken: 'r' });

    expect(reader.read()).toEqual({ id: 42, name: 'Ana', role: 'doctor' });
  });

  it('sem sessão ou sem nome no token mantém o perfil fixo do modo dev', () => {
    expect(reader.read().name).toBe('Michelle Franklin');
    store.open({ accessToken: `h.${btoa('{"nomeCompleto":"  "}')}.s`, refreshToken: 'r' });

    expect(reader.read().name).toBe('Michelle Franklin');
  });
});
