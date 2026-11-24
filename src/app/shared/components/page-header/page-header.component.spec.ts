import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageHeaderComponent } from './page-header.component';

describe('PageHeaderComponent', () => {
  let fixture: ComponentFixture<PageHeaderComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(PageHeaderComponent);
    fixture.componentRef.setInput('title', 'Paciente');
  });

  it('divide o subtítulo "hospital · data" em partes: duas linhas no mobile (Figma 4601:1644)', () => {
    fixture.componentRef.setInput('subtitle', 'Hospital Vila Nova Star · Domingo, 28 de maio');
    fixture.detectChanges();

    const parts = Array.from(el().querySelectorAll('.page-header__subtitle-part')).map(p => p.textContent?.trim());

    expect(parts).toEqual(['Hospital Vila Nova Star', 'Domingo, 28 de maio']);
    expect(el().querySelectorAll('.page-header__subtitle-sep').length).toBe(1);
  });

  it('subtítulo sem separador tem uma parte só e sem separador', () => {
    fixture.componentRef.setInput('subtitle', 'Só o hospital');
    fixture.detectChanges();

    expect(el().querySelectorAll('.page-header__subtitle-part').length).toBe(1);
    expect(el().querySelector('.page-header__subtitle-sep')).toBeNull();
  });

  it('sem subtítulo não renderiza a linha', () => {
    fixture.detectChanges();

    expect(el().querySelector('.page-header__subtitle')).toBeNull();
  });

  it('o ícone do título é de 24px (Figma)', () => {
    fixture.componentRef.setInput('icon', 'bell');
    fixture.detectChanges();

    expect(el().querySelector('.page-header__title ph-icon')).not.toBeNull();
  });
});
