import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { AvatarComponent } from '../avatar/avatar.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { CardNotifyComponent } from './card-notify.component';

describe('CardNotifyComponent', () => {
  let fixture: ComponentFixture<CardNotifyComponent>;

  async function createWith(overrides: {
    authorName?: string;
    authorSpecialty?: string;
    authorPhotoUrl?: string | null;
    description?: string;
    time?: string;
    actionAriaLabel?: string;
    actionDisabled?: boolean;
  }): Promise<void> {
    await TestBed.configureTestingModule({ imports: [CardNotifyComponent] }).compileComponents();
    fixture = TestBed.createComponent(CardNotifyComponent);
    fixture.componentRef.setInput('authorName', overrides.authorName ?? 'Jairo Nepomuceno');
    fixture.componentRef.setInput('authorSpecialty', overrides.authorSpecialty ?? 'Enfermeiro');
    if (overrides.authorPhotoUrl !== undefined) {
      fixture.componentRef.setInput('authorPhotoUrl', overrides.authorPhotoUrl);
    }
    fixture.componentRef.setInput(
      'description',
      overrides.description ?? 'Suspendemos a formula XYZ do paciente Renato Lemos Santos',
    );
    fixture.componentRef.setInput('time', overrides.time ?? '19:27');
    fixture.componentRef.setInput('actionAriaLabel', overrides.actionAriaLabel ?? 'Ver detalhes da notificação');
    if (overrides.actionDisabled !== undefined) {
      fixture.componentRef.setInput('actionDisabled', overrides.actionDisabled);
    }
    fixture.detectChanges();
  }

  function name(): string {
    return fixture.nativeElement.querySelector('.card-notify__name').textContent.trim();
  }

  function specialty(): string {
    return fixture.nativeElement.querySelector('.card-notify__specialty').textContent.trim();
  }

  function description(): string {
    return fixture.nativeElement.querySelector('.card-notify__description').textContent.trim();
  }

  function time(): string {
    return fixture.nativeElement.querySelector('.card-notify__time span').textContent.trim();
  }

  function avatar(): AvatarComponent {
    return fixture.debugElement.query(debug => debug.componentInstance instanceof AvatarComponent)
      .componentInstance as AvatarComponent;
  }

  function iconButton(): IconButtonComponent {
    return fixture.debugElement.query(debug => debug.componentInstance instanceof IconButtonComponent)
      .componentInstance as IconButtonComponent;
  }

  function article(): HTMLElement {
    return fixture.nativeElement.querySelector('.card-notify');
  }

  function descriptionElement(): HTMLElement {
    return fixture.nativeElement.querySelector('.card-notify__description');
  }

  it('exibe nome, especialidade, descrição e horário exatamente como recebidos', async () => {
    await createWith({});

    expect(name()).toBe('Jairo Nepomuceno');
    expect(specialty()).toBe('Enfermeiro');
    expect(description()).toBe('Suspendemos a formula XYZ do paciente Renato Lemos Santos');
    expect(time()).toBe('19:27');
  });

  it('sem authorPhotoUrl: avatar recebe type="user" e name para iniciais', async () => {
    await createWith({ authorPhotoUrl: null });
    const av = avatar();

    expect(av.type()).toBe('user');
    expect(av.name()).toBe('Jairo Nepomuceno');
  });

  it('com authorPhotoUrl: avatar recebe type="photo" e imageUrl', async () => {
    await createWith({ authorPhotoUrl: 'https://example.com/foto.jpg' });
    const av = avatar();

    expect(av.type()).toBe('photo');
    expect(av.imageUrl()).toBe('https://example.com/foto.jpg');
  });

  it('icon-button usa kind="secondary" appearance="outlined" size="small" (Figma nó 4044:2099)', async () => {
    await createWith({});
    const btn = iconButton();

    expect(btn.kind()).toBe('secondary');
    expect(btn.appearance()).toBe('outlined');
    expect(btn.size()).toBe('small');
  });

  it('propaga actionAriaLabel como ariaLabel do icon-button', async () => {
    await createWith({ actionAriaLabel: 'Ver detalhes da notificação' });

    expect(iconButton().ariaLabel()).toBe('Ver detalhes da notificação');
  });

  it('icon-button fica desabilitado quando actionDisabled = true', async () => {
    await createWith({ actionDisabled: true });

    expect(iconButton().disabled()).toBe(true);
  });

  it('icon-button fica habilitado por padrão (actionDisabled = false)', async () => {
    await createWith({});

    expect(iconButton().disabled()).toBe(false);
  });

  describe('área de toque estendida — card inteiro clicável (2026-07-26)', () => {
    it('clicar em qualquer ponto do card (não só no icon-button) emite cardClick quando habilitado', async () => {
      await createWith({});
      const emitted = jasmine.createSpy('emitted');

      fixture.componentInstance.cardClick.subscribe(emitted);

      descriptionElement().click(); // ponto fora do icon-button

      expect(emitted).toHaveBeenCalledTimes(1);
    });

    it('clicar no icon-button interno também emite cardClick (borbulha para o listener do card)', async () => {
      await createWith({});
      const emitted = jasmine.createSpy('emitted');

      fixture.componentInstance.cardClick.subscribe(emitted);

      fixture.nativeElement.querySelector('app-icon-button button').click();

      expect(emitted).toHaveBeenCalledTimes(1);
    });

    it('NÃO emite cardClick quando actionDisabled = true', async () => {
      await createWith({ actionDisabled: true });
      const emitted = jasmine.createSpy('emitted');

      fixture.componentInstance.cardClick.subscribe(emitted);

      article().click();

      expect(emitted).not.toHaveBeenCalled();
    });

    it('o icon-button interno permanece focável/operável por teclado (não vira um segundo controle redundante)', async () => {
      await createWith({});

      expect(article().getAttribute('role')).toBeNull();
      expect(article().getAttribute('tabindex')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-icon-button button').tabIndex).toBe(0);
    });
  });

  describe('card da tela de Notificações (Figma 4506:9462 / 4506:9463 / 4496:11888)', () => {
    const replies = [
      { authorName: 'Dra. Michelle', authorPhotoUrl: null, authorSpecialty: 'Nutróloga', text: 'Ok', time: '20:27' },
      { authorName: 'Dr. Paulo', authorPhotoUrl: null, authorSpecialty: 'Nutrólogo', text: 'Feito', time: '20:40' },
    ];
    const card = (): HTMLElement => fixture.nativeElement.querySelector('.card-notify');

    async function createDetail(inputs: Record<string, unknown> = {}): Promise<void> {
      await createWith({});
      fixture.componentRef.setInput('type', 'detail');
      fixture.componentRef.setInput('patientName', 'José da Silva');
      fixture.componentRef.setInput('replies', replies);
      for (const [key, value] of Object.entries(inputs)) {
        fixture.componentRef.setInput(key, value);
      }
      fixture.detectChanges();
    }

    it('o botão de responder é o balão (chat-circle-dots) secundário, na coluna da direita', async () => {
      await createDetail();
      const button = fixture.nativeElement.querySelector('.card-notify__side app-icon-button');
      const instance = fixture.debugElement.query(By.directive(IconButtonComponent)).componentInstance;

      expect(button).toBeTruthy();
      expect(instance.icon()).toBe('chat-circle-dots');
      expect(instance.kind()).toBe('secondary');
      expect(instance.appearance()).toBe('icon');
    });

    it('card resolvido ou com as respostas abertas não tem a coluna do balão', async () => {
      await createDetail({ resolved: true });

      expect(fixture.nativeElement.querySelector('.card-notify__side')).toBeNull();

      fixture.componentRef.setInput('resolved', false);
      fixture.componentRef.setInput('type', 'answer-open');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.card-notify__side')).toBeNull();
    });

    it('a tag de respostas tem a foto encostada à esquerda (padding 4px) e 16px à direita', async () => {
      await createDetail();
      const style = getComputedStyle(fixture.nativeElement.querySelector('.card-notify__reply-tag'));

      expect(style.paddingLeft).toBe('4px');
      expect(style.paddingRight).toBe('16px');
      expect(fixture.nativeElement.querySelector('.card-notify__reply-tag').textContent).toContain('2 Respostas');
    });

    it('com as respostas abertas, o card cresce na vertical: cada resposta fica abaixo da anterior', async () => {
      await createDetail({ type: 'answer-open' });
      const main = fixture.nativeElement.querySelector('.card-notify__main').getBoundingClientRect();
      const blocks = Array.from(fixture.nativeElement.querySelectorAll('.card-notify__reply')).map(el =>
        (el as HTMLElement).getBoundingClientRect(),
      );

      expect(blocks.length).toBe(2);
      expect(blocks[0].top).toBeGreaterThanOrEqual(main.bottom - 1);
      expect(blocks[1].top).toBeGreaterThanOrEqual(blocks[0].bottom - 1);
      expect(blocks[0].width).toBeCloseTo(card().getBoundingClientRect().width, 0);
      expect(fixture.nativeElement.querySelector('.card-notify__collapse').textContent).toContain('Ver menos');
    });

    it('o texto aparece inteiro (sem corte em 2 linhas)', async () => {
      await createDetail({ description: 'linha '.repeat(80) });
      const text = fixture.nativeElement.querySelector('.card-notify__description') as HTMLElement;

      expect(getComputedStyle(text).overflow).toBe('visible');
      expect(text.scrollHeight).toBeLessThanOrEqual(text.clientHeight + 1);
    });

    it('card resolvido recolhido fica esmaecido; aberto, branco', async () => {
      await createDetail({ resolved: true });

      expect(card().classList).toContain('card-notify--resolved');
      expect(getComputedStyle(card()).backgroundColor).toContain('0.5');

      fixture.componentRef.setInput('type', 'answer-open');
      fixture.detectChanges();

      expect(getComputedStyle(card()).backgroundColor).not.toContain('0.5');
    });
  });
});
