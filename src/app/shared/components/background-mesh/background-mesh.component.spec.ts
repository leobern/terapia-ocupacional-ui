import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BackgroundMeshComponent } from './background-mesh.component';

describe('BackgroundMeshComponent', () => {
  let fixture: ComponentFixture<BackgroundMeshComponent>;

  async function create(
    overrides: {
      color1?: string;
      color2?: string;
      color3?: string;
      showColor3Desktop?: boolean;
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
    if (overrides.color3 !== undefined) {
      fixture.componentRef.setInput('color3', overrides.color3);
    }
    if (overrides.showColor3Desktop !== undefined) {
      fixture.componentRef.setInput('showColor3Desktop', overrides.showColor3Desktop);
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

  function blob(index: 1 | 2 | 3): HTMLElement {
    return fixture.nativeElement.querySelector(`.background-mesh__blob--${index}`);
  }

  function gradientStops(): NodeListOf<SVGStopElement> {
    return fixture.nativeElement.querySelectorAll('radialGradient stop');
  }

  it('usa os hex default quando nenhum input é informado', async () => {
    await create();

    // Figma "Conductia - V1", componente `background`: verde, ciano e azul-marinho.
    expect(blob(1).style.backgroundColor).toBe('rgb(13, 119, 66)'); // #0d7742
    expect(blob(2).style.backgroundColor).toBe('rgb(166, 251, 251)'); // #a6fbfb
    expect(blob(3).style.backgroundColor).toBe('rgb(0, 68, 102)'); // #004466

    const stops = gradientStops();

    expect(stops[0].getAttribute('stop-color')).toBe('#ABB3BA');
    expect(stops[1].getAttribute('stop-color')).toBe('#4D5154');
  });

  it('propaga color1/color2/color3 para os 3 blobs quando informados', async () => {
    await create({ color1: '#ff0000', color2: '#00ff00', color3: '#0000ff' });

    expect(blob(1).style.backgroundColor).toBe('rgb(255, 0, 0)');
    expect(blob(2).style.backgroundColor).toBe('rgb(0, 255, 0)');
    expect(blob(3).style.backgroundColor).toBe('rgb(0, 0, 255)');
  });

  it('usa a geometria do Figma: blur 100px e círculos de 560/560/240px no mobile', async () => {
    await create();

    expect(getComputedStyle(blob(3)).filter).toBe('blur(100px)');
    expect(blob(3).offsetWidth).toBe(560);
    expect(blob(2).offsetWidth).toBe(560);
    expect(blob(1).offsetWidth).toBe(240);
  });

  it('claro: a camada dos círculos mistura em "color" com 100% de opacidade (Figma, Light v2)', async () => {
    await create();
    const layer = fixture.nativeElement.querySelector('.background-mesh__blobs') as HTMLElement;

    expect(getComputedStyle(layer).mixBlendMode).toBe('color');
    expect(getComputedStyle(layer).opacity).toBe('1');
  });

  it('escuro: a camada dos círculos fica com 20% de opacidade e mistura plus-lighter (Figma, Dark v2)', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    await create();
    const layer = fixture.nativeElement.querySelector('.background-mesh__blobs') as HTMLElement;

    expect(getComputedStyle(layer).mixBlendMode).toBe('plus-lighter');
    expect(getComputedStyle(layer).opacity).toBe('0.2');
    document.documentElement.removeAttribute('data-theme');
  });

  it('showColor3Desktop=false marca o host para esconder o 3º círculo no desktop (Notificações)', async () => {
    await create({ showColor3Desktop: false });

    expect(host().classList).toContain('background-mesh--without-third-blob-desktop');
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
