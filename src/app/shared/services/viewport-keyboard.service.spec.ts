import { TestBed } from '@angular/core/testing';

import { ViewportKeyboardService } from './viewport-keyboard.service';

/**
 * O serviço lê `window.visualViewport` no construtor, então cada caso instala o seu
 * mock ANTES de pedir a instância ao TestBed — nunca depois. Os descritores
 * originais são restaurados no `afterEach` para não vazar mock entre specs.
 */
describe('ViewportKeyboardService', () => {
  const INNER_HEIGHT = 800;

  let listeners: Record<string, () => void>;
  let originalVisualViewport: PropertyDescriptor | undefined;
  let originalInnerHeight: PropertyDescriptor | undefined;

  /** Substitui `window.visualViewport` por um mock controlável (ou remove a API). */
  function installVisualViewport(viewport: { height: number; scale: number } | undefined): void {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value:
        viewport === undefined
          ? undefined
          : {
              addEventListener: (type: string, handler: () => void): void => {
                listeners[type] = handler;
              },
              get height(): number {
                return viewport.height;
              },
              removeEventListener: (): void => undefined,
              get scale(): number {
                return viewport.scale;
              },
            },
    });
  }

  function createService(): ViewportKeyboardService {
    return TestBed.inject(ViewportKeyboardService);
  }

  beforeEach(() => {
    listeners = {};
    originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: INNER_HEIGHT });

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    if (originalVisualViewport) {
      Object.defineProperty(window, 'visualViewport', originalVisualViewport);
    }

    if (originalInnerHeight) {
      Object.defineProperty(window, 'innerHeight', originalInnerHeight);
    }
  });

  it('detecta o teclado virtual quando o visual viewport encolhe além do limiar', () => {
    // 800 - 450 = 350px de redução, bem acima dos 150px de limiar.
    installVisualViewport({ height: 450, scale: 1 });

    const service = createService();

    listeners['resize']();

    expect(service.isVirtualKeyboardOpen()).toBeTrue();
  });

  it('ignora reduções pequenas, como a barra de endereço encolhendo ao rolar', () => {
    // 800 - 720 = 80px: menos que o limiar de 150px.
    installVisualViewport({ height: 720, scale: 1 });

    const service = createService();

    listeners['resize']();

    expect(service.isVirtualKeyboardOpen()).toBeFalse();
  });

  it('ignora a redução de altura causada por pinch zoom (scale !== 1)', () => {
    // Altura reduzida o bastante para passar do limiar, mas por zoom, não por teclado.
    installVisualViewport({ height: 400, scale: 2 });

    const service = createService();

    listeners['resize']();

    expect(service.isVirtualKeyboardOpen()).toBeFalse();
  });

  it('degrada silenciosamente quando a API visualViewport não existe', () => {
    installVisualViewport(undefined);

    expect(() => createService()).not.toThrow();

    expect(createService().isVirtualKeyboardOpen()).toBeFalse();
  });

  it('volta a false quando o teclado fecha', () => {
    const viewport = { height: 450, scale: 1 };

    installVisualViewport(viewport);

    const service = createService();

    listeners['resize']();

    expect(service.isVirtualKeyboardOpen()).toBeTrue();

    viewport.height = INNER_HEIGHT;
    listeners['resize']();

    expect(service.isVirtualKeyboardOpen()).toBeFalse();
  });
});
