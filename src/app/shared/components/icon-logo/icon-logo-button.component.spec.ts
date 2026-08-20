import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IconLogoButtonComponent } from './icon-logo-button.component';

describe('IconLogoButtonComponent', () => {
  let fixture: ComponentFixture<IconLogoButtonComponent>;

  async function create(overrides: { ariaLabel?: string; disabled?: boolean } = {}): Promise<void> {
    await TestBed.configureTestingModule({ imports: [IconLogoButtonComponent] }).compileComponents();
    fixture = TestBed.createComponent(IconLogoButtonComponent);
    fixture.componentRef.setInput('ariaLabel', overrides.ariaLabel ?? 'Abrir assistente de IA');
    if (overrides.disabled !== undefined) {
      fixture.componentRef.setInput('disabled', overrides.disabled);
    }
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture?.nativeElement?.remove();
  });

  /** Falha com mensagem útil em vez de usar `!` (proibido por `no-non-null-assertion`). */
  function queryOrFail(selector: string): HTMLElement {
    const el = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);

    if (el === null) {
      throw new Error(`Elemento não encontrado no template: ${selector}`);
    }

    return el;
  }

  function button(): HTMLButtonElement {
    return queryOrFail('button') as HTMLButtonElement;
  }

  describe('semântica de controle (FR-010)', () => {
    it('renderiza um button nativo do tipo button', async () => {
      await create();

      expect(button()).not.toBeNull();
      expect(button().getAttribute('type')).toBe('button');
    });

    it('aplica o ariaLabel como nome acessível', async () => {
      await create({ ariaLabel: 'Abrir assistente de IA' });

      expect(button().getAttribute('aria-label')).toBe('Abrir assistente de IA');
    });

    it('não marca o host como aria-hidden — é um controle, não decoração', async () => {
      await create();

      expect((fixture.nativeElement as HTMLElement).getAttribute('aria-hidden')).toBeNull();
    });
  });

  describe('evento clicked', () => {
    it('emite no clique quando habilitado', async () => {
      await create();
      let emissions = 0;

      fixture.componentInstance.clicked.subscribe(() => (emissions += 1));

      button().click();

      expect(emissions).toBe(1);
    });

    it('não emite quando disabled', async () => {
      await create({ disabled: true });
      let emissions = 0;

      fixture.componentInstance.clicked.subscribe(() => (emissions += 1));

      button().click();

      expect(emissions).toBe(0);
    });
  });

  describe('estado disabled', () => {
    it('propaga disabled ao elemento button, mantendo-o no DOM', async () => {
      await create({ disabled: true });

      expect(button().disabled).toBeTrue();
      expect(button().isConnected).toBeTrue();
    });

    it('usa o visual disabled do Figma', async () => {
      await create({ disabled: true });

      const visual = (fixture.nativeElement as HTMLElement).querySelector('app-icon-logo-visual');

      expect(visual?.getAttribute('data-state')).toBe('disabled');
    });

    it('usa o visual button quando habilitado, sem a camada de halo', async () => {
      await create();

      const root = fixture.nativeElement as HTMLElement;

      expect(root.querySelector('app-icon-logo-visual')?.getAttribute('data-state')).toBe('button');
      expect(root.querySelector('.icon-logo__halo')).toBeNull();
    });
  });

  describe('hover revela as luzes estáticas (FR-014)', () => {
    it('marca lights-visible no hover quando habilitado', async () => {
      await create();
      const root = fixture.nativeElement as HTMLElement;

      button().dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();

      expect(root.querySelector('app-icon-logo-visual')?.classList).toContain('icon-logo--lights-visible');
    });

    it('remove lights-visible ao sair do hover', async () => {
      await create();
      const root = fixture.nativeElement as HTMLElement;

      button().dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      button().dispatchEvent(new MouseEvent('mouseleave'));
      fixture.detectChanges();

      expect(root.querySelector('app-icon-logo-visual')?.classList).not.toContain('icon-logo--lights-visible');
    });

    it('não reage a hover quando disabled', async () => {
      await create({ disabled: true });
      const root = fixture.nativeElement as HTMLElement;

      button().dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();

      expect(root.querySelector('app-icon-logo-visual')?.classList).not.toContain('icon-logo--lights-visible');
    });
  });

  describe('área de toque (FR-015)', () => {
    it('mantém pelo menos 44x44 mesmo com --icon-logo-size menor', async () => {
      await create();
      (fixture.nativeElement as HTMLElement).style.setProperty('--icon-logo-size', '24px');
      fixture.detectChanges();

      const rect = button().getBoundingClientRect();

      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    });

    it('não estende o alvo clicável até a caixa de bleed do núcleo (SC-011)', async () => {
      await create();
      (fixture.nativeElement as HTMLElement).style.setProperty('--icon-logo-size', '48px');
      fixture.detectChanges();

      // O núcleo mede 1.75x (84px); o botão deve medir o círculo (48px), não a caixa.
      expect(button().getBoundingClientRect().width).toBeCloseTo(48, 0);
    });

    it('reserva a mesma caixa de bleed do decorativo, para os dois alinharem', async () => {
      await create();
      (fixture.nativeElement as HTMLElement).style.setProperty('--icon-logo-size', '48px');
      fixture.detectChanges();

      // O host DEVE medir 1.75x o círculo (84px), igual a `<app-icon-logo>`. Se medir o
      // tamanho do botão (48px), um logo decorativo e um botão lado a lado saem
      // desalinhados verticalmente — regressão encontrada na validação de 2026-07-26.
      const host = (fixture.nativeElement as HTMLElement).getBoundingClientRect();

      expect(host.width).toBeCloseTo(84, 0);
      expect(host.height).toBeCloseTo(84, 0);
    });

    it('centra o círculo na caixa do host (sem deslocamento por baseline)', async () => {
      await create();
      (fixture.nativeElement as HTMLElement).style.setProperty('--icon-logo-size', '48px');
      fixture.detectChanges();

      const host = (fixture.nativeElement as HTMLElement).getBoundingClientRect();
      const circulo = queryOrFail('.icon-logo__base').getBoundingClientRect();

      expect(circulo.top + circulo.height / 2).toBeCloseTo(host.top + host.height / 2, 0);
      expect(circulo.left + circulo.width / 2).toBeCloseTo(host.left + host.width / 2, 0);
    });

    it('deixa o núcleo visual inerte a ponteiro', async () => {
      await create();

      const visual = queryOrFail('app-icon-logo-visual');

      expect(getComputedStyle(visual).pointerEvents).toBe('none');
    });
  });

  describe('anel de foco sistêmico', () => {
    it('aplica a classe keyboard-focus quando o foco vem do teclado', async () => {
      await create();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      button().dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();

      expect(button().classList).toContain('keyboard-focus');
    });

    it('não aplica keyboard-focus quando o foco vem do ponteiro', async () => {
      await create();

      document.dispatchEvent(new MouseEvent('mousedown'));
      button().dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();

      expect(button().classList).not.toContain('keyboard-focus');
    });

    it('remove keyboard-focus no blur', async () => {
      await create();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      button().dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();
      button().dispatchEvent(new FocusEvent('blur'));
      fixture.detectChanges();

      expect(button().classList).not.toContain('keyboard-focus');
    });
  });
});
