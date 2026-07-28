import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IconLogoVisualComponent, type IconLogoVisualState } from './icon-logo-visual.component';

/**
 * Geometria "golden" da malha — cópia literal do atributo `d` de
 * `specs/ds/DS-component-icon-logo/assets/figma-mesh-default.svg` (exportação do nó Figma
 * `4424:6362`). O `d` é byte-a-byte idêntico nas 4 variantes do Figma; só o `stroke` muda.
 *
 * A duplicação é intencional: este é um teste de fidelidade (SC-003). Se alguém redesenhar a
 * malha à mão ou reexportar com outro tamanho, este teste falha — que é exatamente o ponto.
 */
const FIGMA_MESH_PATH =
  'M1.60329 14.6623L8.34467 12.6496M1.60329 14.6623L9.21709 21.9872M16.6921 1.18461L8.34467 5.87252L1.60329 14.6623L0.304586 24.3311L2.31709 33.0872L7.55157 40.1528L14.9671 45.1337L25.3171 46.3056L34.8046 43.3757L42.5671 35.8853L46.3046 22.8661L43.4296 13.4903L37.2929 4.99353L26.4671 0.305631L16.6921 1.18461ZM8.34467 12.6496L9.21709 21.9872M8.34467 12.6496V5.87252M8.34467 12.6496L16.1171 14.6623M9.21709 21.9872L22.4421 26.0891M9.21709 21.9872L16.1171 14.6623M9.21709 21.9872L0.304586 24.3311M9.21709 21.9872L11.5171 28.5477M8.34467 5.87252L16.1171 14.6623M16.1171 14.6623L16.6921 1.18461M16.1171 14.6623L23.8796 11.1464M16.1171 14.6623L22.4421 26.0891M16.6921 1.18461L23.8796 11.1464M23.8796 11.1464L26.4671 0.305631M23.8796 11.1464L33.6546 19.6432M23.8796 11.1464L31.0671 7.04448M23.8796 11.1464L22.4421 26.0891M26.4671 0.305631L31.0671 7.04448M33.6546 19.6432L31.0671 7.04448M33.6546 19.6432L37.2929 4.99353M33.6546 19.6432L43.4296 13.4903M33.6546 19.6432L40.5546 24.3311M33.6546 19.6432L31.0671 31.363M33.6546 19.6432L22.4421 26.0891M31.0671 7.04448L37.2929 4.99353M43.4296 13.4903L40.5546 24.3311M40.5546 24.3311L46.3046 22.8661M40.5546 24.3311L42.5671 35.8853M40.5546 24.3311L31.0671 31.363M42.5671 35.8853L31.0671 31.363M31.0671 31.363L22.4421 26.0891M31.0671 31.363L18.4171 35.8853M31.0671 31.363L25.3171 46.3056M31.0671 31.363L34.8046 43.3757M22.4421 26.0891L11.5171 28.5477M22.4421 26.0891L18.4171 35.8853M0.304586 24.3311L11.5171 28.5477M2.31709 33.0872L11.5171 28.5477M2.31709 33.0872L18.4171 35.8853M11.5171 28.5477L18.4171 35.8853M18.4171 35.8853L25.3171 46.3056M18.4171 35.8853L14.9671 45.1337M18.4171 35.8853L7.55157 40.1528';

describe('IconLogoVisualComponent', () => {
  let fixture: ComponentFixture<IconLogoVisualComponent>;

  async function create(state: IconLogoVisualState = 'default', size?: string): Promise<void> {
    // Vários testes comparam dois estados/tamanhos no mesmo `it`, o que exige reconfigurar
    // o TestBed — só permitido após reset explícito.
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [IconLogoVisualComponent] }).compileComponents();
    fixture = TestBed.createComponent(IconLogoVisualComponent);
    fixture.componentRef.setInput('state', state);
    if (size !== undefined) {
      (fixture.nativeElement as HTMLElement).style.setProperty('--icon-logo-size', size);
    }
    // Anexar ao documento é obrigatório: `getComputedStyle` só resolve valores reais
    // (incluindo `calc()` sobre custom properties) para elementos no DOM.
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture?.nativeElement?.remove();
  });

  function query(selector: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(selector);
  }

  /**
   * Como `query`, mas falha com mensagem útil se o elemento não existir — evita o
   * operador `!` (proibido por `@typescript-eslint/no-non-null-assertion`) sem perder
   * a tipagem.
   */
  function queryOrFail(selector: string): HTMLElement {
    const el = query(selector);

    if (el === null) {
      throw new Error(`Elemento não encontrado no template: ${selector}`);
    }

    return el;
  }

  describe('fidelidade da geometria da malha (SC-003)', () => {
    it('usa exatamente o path exportado do Figma, sem redesenho manual', async () => {
      await create();

      const path = query('.icon-logo__mesh path');

      expect(path?.getAttribute('d')).toBe(FIGMA_MESH_PATH);
    });

    it('preserva o viewBox e a espessura de traço da exportação', async () => {
      await create();

      const svg = query('.icon-logo__mesh');

      expect(svg?.getAttribute('viewBox')).toBe('0 0 46.6175 46.6108');
      expect(query('.icon-logo__mesh path')?.getAttribute('stroke-width')).toBe('0.6');
    });

    it('não usa vector-effect: non-scaling-stroke (congelaria o traço — FR-013)', async () => {
      await create();

      expect(query('.icon-logo__mesh path')?.getAttribute('vector-effect')).toBeNull();
    });

    it('pinta o traço por currentColor, para o stroke vir de token por estado', async () => {
      await create();

      expect(query('.icon-logo__mesh path')?.getAttribute('stroke')).toBe('currentColor');
    });
  });

  describe('escala por --icon-logo-size (SC-008)', () => {
    it('dobra a borda quando o tamanho dobra, no visual default', async () => {
      await create('default', '48px');
      const at48 = getComputedStyle(queryOrFail('.icon-logo__base')).borderTopWidth;

      fixture.nativeElement.remove();
      await create('default', '96px');
      const at96 = getComputedStyle(queryOrFail('.icon-logo__base')).borderTopWidth;

      expect(parseFloat(at48)).toBeCloseTo(2, 1);
      expect(parseFloat(at96)).toBeCloseTo(4, 1);
    });

    it('usa borda mais fina no visual disabled, e ela também escala', async () => {
      await create('disabled', '48px');
      const at48 = getComputedStyle(queryOrFail('.icon-logo__base')).borderTopWidth;

      fixture.nativeElement.remove();
      await create('disabled', '96px');
      const at96 = getComputedStyle(queryOrFail('.icon-logo__base')).borderTopWidth;

      expect(parseFloat(at48)).toBeCloseTo(1, 1);
      expect(parseFloat(at96)).toBeCloseTo(2, 1);
    });

    it('reserva caixa de bleed de 1.75x o tamanho do círculo (FR-017)', async () => {
      await create('default', '48px');

      const host = fixture.nativeElement as HTMLElement;

      expect(host.getBoundingClientRect().width).toBeCloseTo(84, 0);
    });
  });

  describe('matriz de camadas por estado (data-model.md §2)', () => {
    it('omite a camada surface apenas no visual disabled', async () => {
      await create('disabled');

      expect(query('.icon-logo__surface')).toBeNull();

      fixture.nativeElement.remove();
      await create('default');

      expect(query('.icon-logo__surface')).not.toBeNull();
    });

    it('omite a camada de halo apenas no visual button', async () => {
      await create('button');

      expect(query('.icon-logo__halo')).toBeNull();

      fixture.nativeElement.remove();
      await create('disabled');

      expect(query('.icon-logo__halo')).not.toBeNull();
    });

    it('mantém as 3 luzes no DOM em todos os estados, para permitir crossfade (FR-011)', async () => {
      await create('default');

      expect((fixture.nativeElement as HTMLElement).querySelectorAll('.icon-logo__light').length).toBe(3);
    });

    it('deixa as luzes invisíveis fora de anim e visíveis em anim', async () => {
      await create('default');

      expect(parseFloat(getComputedStyle(queryOrFail('.icon-logo__light--1')).opacity)).toBe(0);

      fixture.nativeElement.remove();
      await create('anim');

      expect(parseFloat(getComputedStyle(queryOrFail('.icon-logo__light--1')).opacity)).toBe(1);
    });
  });

  describe('composição de cor (research.md §1)', () => {
    it('aplica mix-blend-mode: color nas 3 luzes', async () => {
      await create('anim');

      for (const selector of ['.icon-logo__light--1', '.icon-logo__light--2', '.icon-logo__light--3']) {
        expect(getComputedStyle(queryOrFail(selector)).mixBlendMode).toBe('color');
      }
    });

    it('aplica mix-blend-mode: multiply na camada surface', async () => {
      await create('default');

      expect(getComputedStyle(queryOrFail('.icon-logo__surface')).mixBlendMode).toBe('multiply');
    });

    it('não cria stacking context em nenhum ancestral das luzes', async () => {
      await create('anim');

      // Um `transform`, `filter`, `will-change` ou `isolation` no host ou no wrapper isolaria
      // o blend das luzes, transformando-as em manchas chapadas (research.md §1). Este teste
      // é a rede de segurança contra alguém "otimizar" o componente e quebrá-lo em silêncio.
      for (const element of [fixture.nativeElement as HTMLElement, queryOrFail('.icon-logo__symbol')]) {
        const style = getComputedStyle(element);

        expect(style.transform).toBe('none');
        expect(style.filter).toBe('none');
        expect(style.isolation).toBe('auto');
        expect(style.willChange).toBe('auto');
        expect(parseFloat(style.opacity)).toBe(1);
      }
    });
  });
});
