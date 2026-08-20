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
  function installVisualViewport(viewport: { height: number; offsetTop?: number; scale: number } | undefined): void {
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
              get offsetTop(): number {
                return viewport.offsetTop ?? 0;
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

  /**
   * `keyboardInsetPx` existe para quem precisa ANCORAR algo acima do teclado (o
   * rodapé do `app-bottom-sheet`), não só se retirar do caminho como a navbar.
   * Por isso é uma medida, não um booleano.
   */
  describe('keyboardInsetPx', () => {
    it('mede a faixa ocupada pelo teclado', () => {
      // 800 - (450 + 0) = 350px de teclado.
      installVisualViewport({ height: 450, offsetTop: 0, scale: 1 });

      const service = createService();

      listeners['resize']();

      expect(service.keyboardInsetPx()).toBe(350);
    });

    it('desconta o deslocamento do visual viewport', () => {
      // No iOS o teclado desloca o viewport além de encolhê-lo: 800 - (450 + 30).
      installVisualViewport({ height: 450, offsetTop: 30, scale: 1 });

      const service = createService();

      listeners['scroll']();

      expect(service.keyboardInsetPx()).toBe(320);
    });

    it('é zero com o teclado fechado', () => {
      installVisualViewport({ height: INNER_HEIGHT, offsetTop: 0, scale: 1 });

      const service = createService();

      listeners['resize']();

      expect(service.keyboardInsetPx()).toBe(0);
    });

    it('nunca é negativo', () => {
      // O visual viewport pode ficar MAIOR que o layout viewport (barra de endereço
      // recolhendo); sem o piso em zero, o rodapé seria empurrado para fora da tela.
      installVisualViewport({ height: INNER_HEIGHT + 120, offsetTop: 0, scale: 1 });

      const service = createService();

      listeners['resize']();

      expect(service.keyboardInsetPx()).toBe(0);
    });

    it('é zero sob pinch zoom, mesmo com o viewport encolhido', () => {
      installVisualViewport({ height: 400, offsetTop: 0, scale: 2 });

      const service = createService();

      listeners['resize']();

      expect(service.keyboardInsetPx()).toBe(0);
    });

    it('é zero quando a API visualViewport não existe', () => {
      installVisualViewport(undefined);

      expect(createService().keyboardInsetPx()).toBe(0);
    });
  });
});
