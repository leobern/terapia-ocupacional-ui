import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BackgroundMeshComponent } from './background-mesh.component';

describe('BackgroundMeshComponent', () => {
  let fixture: ComponentFixture<BackgroundMeshComponent>;

  async function create(
    overrides: {
      color1?: string;
      color2?: string;
      meshGradientCoreColor?: string;
      meshGradientEdgeColor?: string;
    } = {},
  ): Promise<void> {
    await TestBed.configureTestingModule({ imports: [BackgroundMeshComponent] }).compileComponents();
    fixture = TestBed.createComponent(BackgroundMeshComponent);
    if (overrides.color1 !== undefined) {
      fixture.componentRef.setInput('color1', overrides.color1);
    }
    if (overrides.color2 !== undefined) {
      fixture.componentRef.setInput('color2', overrides.color2);
    }
    if (overrides.meshGradientCoreColor !== undefined) {
      fixture.componentRef.setInput('meshGradientCoreColor', overrides.meshGradientCoreColor);
    }
    if (overrides.meshGradientEdgeColor !== undefined) {
      fixture.componentRef.setInput('meshGradientEdgeColor', overrides.meshGradientEdgeColor);
    }
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement;
  }

  function blob(index: 1 | 2): HTMLElement {
    return fixture.nativeElement.querySelector(`.background-mesh__blob--${index}`);
  }

  function gradientStops(): NodeListOf<SVGStopElement> {
    return fixture.nativeElement.querySelectorAll('radialGradient stop');
  }

  it('usa os hex default quando nenhum input é informado', async () => {
    await create();

    expect(blob(1).style.backgroundColor).toBe('rgb(211, 255, 233)'); // #D3FFE9
    expect(blob(2).style.backgroundColor).toBe('rgb(166, 251, 251)'); // #a6fbfb

    const stops = gradientStops();

    expect(stops[0].getAttribute('stop-color')).toBe('#ABB3BA');
    expect(stops[1].getAttribute('stop-color')).toBe('#4D5154');
  });

  it('propaga color1/color2 para os 2 blobs quando informados', async () => {
    await create({ color1: '#ff0000', color2: '#00ff00' });

    expect(blob(1).style.backgroundColor).toBe('rgb(255, 0, 0)');
    expect(blob(2).style.backgroundColor).toBe('rgb(0, 255, 0)');
  });

  it('propaga meshGradientCoreColor/meshGradientEdgeColor para os 2 stops do gradiente', async () => {
    await create({ meshGradientCoreColor: '#111111', meshGradientEdgeColor: '#222222' });

    const stops = gradientStops();

    expect(stops[0].getAttribute('stop-color')).toBe('#111111');
    expect(stops[1].getAttribute('stop-color')).toBe('#222222');
  });

  it('o 2º stop do gradiente sempre tem stop-opacity="0", independente da cor recebida', async () => {
    await create({ meshGradientEdgeColor: '#222222' });

    expect(gradientStops()[1].getAttribute('stop-opacity')).toBe('0');
  });

  it('elemento raiz é aria-hidden e não intercepta interação (pointer-events: none)', async () => {
    await create();

    expect(host().getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(host()).pointerEvents).toBe('none');
  });

  it('não usa requestAnimationFrame nem setInterval — componente estático, sem lógica de motion', () => {
    const source = BackgroundMeshComponent.toString();

    expect(source).not.toContain('requestAnimationFrame');
    expect(source).not.toContain('setInterval');
  });

  it('os blobs não têm nenhuma animação CSS aplicada (flutuação removida, 2026-07-26)', async () => {
    await create();

    expect(getComputedStyle(blob(1)).animationName).toBe('none');
    expect(getComputedStyle(blob(2)).animationName).toBe('none');
  });
});
