import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IconLogoComponent } from './icon-logo.component';
import type { IconLogoState } from './icon-logo-visual.component';

describe('IconLogoComponent', () => {
  let fixture: ComponentFixture<IconLogoComponent>;

  async function create(state?: IconLogoState): Promise<void> {
    // Alguns testes percorrem os 3 estados no mesmo `it`, o que exige reconfigurar o
    // TestBed — só permitido após reset explícito.
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [IconLogoComponent] }).compileComponents();
    fixture = TestBed.createComponent(IconLogoComponent);
    if (state !== undefined) {
      fixture.componentRef.setInput('state', state);
    }
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture?.nativeElement?.remove();
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  describe('acessibilidade — é decorativo, nunca controle (FR-010)', () => {
    it('marca o host como aria-hidden', async () => {
      await create();

      expect(host().getAttribute('aria-hidden')).toBe('true');
    });

    // Um `it` por estado em vez de um laço: `await` dentro de loop é proibido por
    // `no-await-in-loop`, e testes separados dão falhas mais precisas de qualquer forma.
    for (const state of ['default', 'anim', 'disabled'] as const) {
      it(`não renderiza nenhum elemento focável no estado ${state}`, async () => {
        await create(state);

        const focusable = host().querySelectorAll('button, a, input, [tabindex]');

        expect(focusable.length).toBe(0);
      });
    }

    it('não intercepta ponteiro', async () => {
      await create();

      expect(getComputedStyle(host()).pointerEvents).toBe('none');
    });
  });

  describe('propagação de estado ao núcleo visual', () => {
    it('usa default quando nenhum estado é informado', async () => {
      await create();

      expect(host().querySelector('app-icon-logo-visual')?.getAttribute('data-state')).toBe('default');
    });

    for (const state of ['default', 'anim', 'disabled'] as const) {
      it(`propaga o estado ${state} para o núcleo`, async () => {
        await create(state);

        expect(host().querySelector('app-icon-logo-visual')?.getAttribute('data-state')).toBe(state);
      });
    }

    it('omite a camada surface no estado disabled (matriz do Figma)', async () => {
      await create('disabled');

      expect(host().querySelector('.icon-logo__surface')).toBeNull();
    });
  });

  describe('escala herdada pelo consumidor', () => {
    it('deixa --icon-logo-size definido no consumidor chegar até o núcleo', async () => {
      await create();
      host().style.setProperty('--icon-logo-size', '96px');
      fixture.detectChanges();

      const base = host().querySelector('.icon-logo__base');

      if (base === null) {
        throw new Error('camada `.icon-logo__base` não encontrada');
      }

      // Se o núcleo declarasse `--icon-logo-size` no próprio `:host`, ele bloquearia o
      // valor herdado e a borda continuaria em 2px.
      expect(parseFloat(getComputedStyle(base).borderTopWidth)).toBeCloseTo(4, 1);
    });
  });
});
