import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphMetaComponent, GraphMetaSize } from './graph-meta.component';

describe('GraphMetaComponent', () => {
  let fixture: ComponentFixture<GraphMetaComponent>;

  async function createWith(overrides: {
    topPercentage?: number;
    bottomPercentage?: number;
    size?: GraphMetaSize;
    ariaLabel?: string;
  }): Promise<void> {
    await TestBed.configureTestingModule({ imports: [GraphMetaComponent] }).compileComponents();
    fixture = TestBed.createComponent(GraphMetaComponent);
    fixture.componentRef.setInput('topPercentage', overrides.topPercentage ?? 80);
    fixture.componentRef.setInput('bottomPercentage', overrides.bottomPercentage ?? 70);
    fixture.componentRef.setInput('size', overrides.size ?? 'Default');
    fixture.componentRef.setInput('ariaLabel', overrides.ariaLabel ?? 'Progresso: 80%, 70%');
    fixture.detectChanges();
  }

  function progressCircles(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('circle.progress'));
  }

  function trackCircles(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('circle:not(.progress)'));
  }

  function dasharrayOf(el: HTMLElement): number[] {
    const raw = el.getAttribute('stroke-dasharray');

    if (!raw) {
      throw new Error('stroke-dasharray ausente no elemento');
    }

    return raw.split(' ').map(Number);
  }

  it('renderiza um SVG com 2 pares de círculos concêntricos (topo + base)', async () => {
    await createWith({});

    expect(fixture.nativeElement.querySelectorAll('circle').length).toBe(4);
  });

  it('propaga ariaLabel como aria-label do svg role="img", sem gerar texto próprio', async () => {
    await createWith({ ariaLabel: 'Aporte calórico 80%, aporte protéico 70%' });
    const svg = fixture.nativeElement.querySelector('svg');

    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Aporte calórico 80%, aporte protéico 70%');
  });

  describe('faixas de cor (independentes por arco)', () => {
    it('0% usa a cor disabled, sem vazamento de cor normal (Princípio VIII)', async () => {
      await createWith({ topPercentage: 0, bottomPercentage: 0 });
      const [outer, inner] = progressCircles();

      expect(outer.getAttribute('stroke')).toBe('var(--color-state-disabled)');
      expect(inner.getAttribute('stroke')).toBe('var(--color-state-disabled)');
    });

    it('1–10% usa a cor de alerta (vermelho) em ambos os arcos', async () => {
      await createWith({ topPercentage: 5, bottomPercentage: 10 });
      const [outer, inner] = progressCircles();

      expect(outer.getAttribute('stroke')).toBe('var(--color-comm-alert)');
      expect(inner.getAttribute('stroke')).toBe('var(--color-comm-alert)');
    });

    it('11–49% usa a cor de aviso (amarelo) em ambos os arcos', async () => {
      await createWith({ topPercentage: 11, bottomPercentage: 49 });
      const [outer, inner] = progressCircles();

      expect(outer.getAttribute('stroke')).toBe('var(--color-comm-warning)');
      expect(inner.getAttribute('stroke')).toBe('var(--color-comm-warning)');
    });

    it('50–100% usa verde no arco de topo e azul no arco de base', async () => {
      await createWith({ topPercentage: 50, bottomPercentage: 100 });
      const [outer, inner] = progressCircles();

      expect(outer.getAttribute('stroke')).toBe('var(--color-comm-success)');
      expect(inner.getAttribute('stroke')).toBe('var(--color-content-2)');
    });

    it('cada arco resolve sua cor de forma totalmente independente do outro', async () => {
      await createWith({ topPercentage: 81, bottomPercentage: 35 });
      const [outer, inner] = progressCircles();

      expect(outer.getAttribute('stroke')).toBe('var(--color-comm-success)');
      expect(inner.getAttribute('stroke')).toBe('var(--color-comm-warning)');
    });

    // Achado de /speckit-converge (T013): valor decimal no intervalo aberto
    // (49, 50) — ex.: 49.5 — não pode "vazar" para a faixa ≥50% só porque
    // ultrapassa o inteiro 49; deve permanecer na faixa de aviso (11–49%).
    it('valor decimal em (49, 50), ex. 49.5%, permanece na faixa de aviso (amarelo), não vaza para ≥50%', async () => {
      await createWith({ topPercentage: 49.5, bottomPercentage: 49.99 });
      const [outer, inner] = progressCircles();

      expect(outer.getAttribute('stroke')).toBe('var(--color-comm-warning)');
      expect(inner.getAttribute('stroke')).toBe('var(--color-comm-warning)');
    });
  });

  it('clampa valores fora de [0, 100]', async () => {
    await createWith({ topPercentage: -10, bottomPercentage: 150 });
    const [outer, inner] = progressCircles();

    // -10 clampado para 0 → disabled; 150 clampado para 100 → faixa 50-100
    expect(outer.getAttribute('stroke')).toBe('var(--color-state-disabled)');
    expect(inner.getAttribute('stroke')).toBe('var(--color-content-2)');

    const [innerLength] = dasharrayOf(inner);
    const innerTrack = trackCircles()[1];
    const [innerHalfCircumference] = dasharrayOf(innerTrack);

    expect(innerLength).toBeCloseTo(innerHalfCircumference, 5);
  });

  it('trilho de ambos os arcos é sempre --color-border, independente do valor', async () => {
    await createWith({ topPercentage: 0, bottomPercentage: 100 });
    const [outerTrack, innerTrack] = trackCircles();

    expect(outerTrack.getAttribute('stroke')).toBe('var(--color-border)');
    expect(innerTrack.getAttribute('stroke')).toBe('var(--color-border)');
  });

  describe('size', () => {
    // Altura não é travada em exatamente metade da largura: a implementação de
    // referência (nutritional-goal-ring) reserva uma margem extra igual à
    // espessura do traço para a ponta arredondada (stroke-linecap: round) não
    // ser cortada pelo viewBox — mesma decisão validada em produção, reaproveitada
    // aqui (research.md §1). Por isso a asserção é "é uma meia-circunferência"
    // (altura < largura), não um valor exato de altura.
    it('size="Default" (ou omitido) produz largura 48, meia-circunferência (altura < largura)', async () => {
      await createWith({ size: 'Default' });
      const svg = fixture.nativeElement.querySelector('svg');

      expect(Number(svg.getAttribute('width'))).toBe(48);
      expect(Number(svg.getAttribute('height'))).toBeLessThan(48);
    });

    it('size="Small" produz largura 32, meia-circunferência (altura < largura)', async () => {
      await createWith({ size: 'Small' });
      const svg = fixture.nativeElement.querySelector('svg');

      expect(Number(svg.getAttribute('width'))).toBe(32);
      expect(Number(svg.getAttribute('height'))).toBeLessThan(32);
    });
  });
});
