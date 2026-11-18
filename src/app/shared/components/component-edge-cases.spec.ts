import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { UserDirectory } from '../services/user-directory';
import { ViewportBreakpointService } from '../services/viewport-breakpoint.service';
import { AssistantFormComponent } from './assistant-form/assistant-form.component';
import { AvatarComponent } from './avatar/avatar.component';
import { BottomSheetComponent } from './bottom-sheet/bottom-sheet.component';
import { IconLogoButtonComponent } from './icon-logo/icon-logo-button.component';

describe('Casos de borda dos componentes compartilhados', () => {
  it('avatar: um nome que não pode ser processado cai nas iniciais de erro "--"', () => {
    const fixture = TestBed.createComponent(AvatarComponent);

    fixture.componentRef.setInput('name', {
      trim: (): never => {
        throw new Error('x');
      },
    } as unknown as string);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('--');
  });

  it('botão da logo desabilitado não emite clicked', () => {
    const fixture = TestBed.createComponent(IconLogoButtonComponent);
    let clicks = 0;

    fixture.componentRef.setInput('ariaLabel', 'Abrir assistente');
    fixture.componentRef.setInput('disabled', true);
    fixture.componentInstance.clicked.subscribe(() => clicks++);
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { onClick(): void }).onClick();

    expect(clicks).toBe(0);
  });

  it('bottom sheet: começar o arraste sem o dialog renderizado (desktop) não faz nada', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ViewportBreakpointService, useValue: { isDesktop: signal(true).asReadonly() } }],
    });
    const fixture = TestBed.createComponent(BottomSheetComponent);

    fixture.componentRef.setInput('ariaLabel', 'Assistente');
    fixture.detectChanges();

    expect(() =>
      (fixture.componentInstance as unknown as { onPointerDown(e: PointerEvent): void }).onPointerDown(
        new PointerEvent('pointerdown', { clientY: 0 }),
      ),
    ).not.toThrow();
  });

  it('formulário do assistente: enviar sem as respostas obrigatórias não chama o cadastro', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: UserDirectory, useValue: { search: (): Promise<[]> => Promise.resolve([]) } }],
    });
    const fixture = TestBed.createComponent(AssistantFormComponent);
    let submitted = 0;

    fixture.componentRef.setInput('definition', {
      fields: [{ id: 'a', kind: 'text', label: 'A?', placeholder: '', required: true }],
      submit: (): void => {
        submitted++;
      },
      submitLabel: 'Criar',
      title: 'Criar',
    });
    fixture.detectChanges();
    await (fixture.componentInstance as unknown as { onSubmit(): Promise<void> }).onSubmit();

    expect(submitted).toBe(0);
  });
});
