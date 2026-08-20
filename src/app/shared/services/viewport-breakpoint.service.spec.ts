import { TestBed } from '@angular/core/testing';

import { BREAKPOINT_MD_PX, ViewportBreakpointService } from './viewport-breakpoint.service';

/**
 * Mesmo formato de `viewport-keyboard.service.spec.ts`: o serviço lê a API do
 * navegador no construtor, então cada caso instala o mock ANTES de pedir a
 * instância ao TestBed, e o descritor original é restaurado no `afterEach` para
 * não vazar mock entre specs.
 */
describe('ViewportBreakpointService', () => {
  let listeners: Record<string, (event: { matches: boolean }) => void>;
  let originalMatchMedia: PropertyDescriptor | undefined;
  let requestedQuery: string | null;

  /** Substitui `window.matchMedia` por um mock controlável (ou remove a API). */
  function installMatchMedia(initialMatches: boolean | undefined): void {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value:
        initialMatches === undefined
          ? undefined
          : (query: string): MediaQueryList => {
              requestedQuery = query;

              // O mock cobre só a fatia da API que o serviço usa; o `unknown`
              // intermediário é o que permite tipá-lo como `MediaQueryList` sem
              // implementar `EventTarget` inteiro.
              return {
                addEventListener: (type: string, handler: (event: { matches: boolean }) => void): void => {
                  listeners[type] = handler;
                },
                matches: initialMatches,
                media: query,
                removeEventListener: (): void => undefined,
              } as unknown as MediaQueryList;
            },
    });
  }

  function createService(): ViewportBreakpointService {
    return TestBed.inject(ViewportBreakpointService);
  }

  beforeEach(() => {
    listeners = {};
    requestedQuery = null;
    originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    }
  });

  it('consulta exatamente o breakpoint md do design system', () => {
    installMatchMedia(false);

    createService();

    // O número vive em _breakpoints.scss; a constante existe para o TypeScript não
    // duplicar o literal. Se os dois divergirem, é aqui que aparece.
    expect(requestedQuery).toBe(`(min-width: ${BREAKPOINT_MD_PX}px)`);
    expect(BREAKPOINT_MD_PX).toBe(1200);
  });

  it('reporta desktop quando a viewport já abre em md ou acima', () => {
    installMatchMedia(true);

    expect(createService().isDesktop()).toBeTrue();
  });

  it('reporta não-desktop abaixo de md', () => {
    installMatchMedia(false);

    expect(createService().isDesktop()).toBeFalse();
  });

  it('acompanha a mudança de media query em tempo real', () => {
    installMatchMedia(false);

    const service = createService();

    expect(service.isDesktop()).toBeFalse();

    listeners['change']({ matches: true });

    expect(service.isDesktop()).toBeTrue();

    listeners['change']({ matches: false });

    expect(service.isDesktop()).toBeFalse();
  });

  it('degrada silenciosamente quando a API matchMedia não existe', () => {
    installMatchMedia(undefined);

    expect(() => createService()).not.toThrow();

    // `false` é a degradação segura: o bottom-sheet é montado (mobile-first),
    // em vez de sumir num ambiente que só não sabe informar a largura.
    expect(createService().isDesktop()).toBeFalse();
  });
});
