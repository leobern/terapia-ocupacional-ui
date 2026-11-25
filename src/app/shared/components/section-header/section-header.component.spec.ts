import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SectionHeaderComponent } from './section-header.component';

describe('SectionHeaderComponent', () => {
  let fixture: ComponentFixture<SectionHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SectionHeaderComponent] }).compileComponents();
    fixture = TestBed.createComponent(SectionHeaderComponent);
    fixture.componentRef.setInput('title', 'Diagnóstico');
  });

  it('mostra só o título quando não há ação', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Diagnóstico');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('com ação, mostra o botão e emite o clique', () => {
    fixture.componentRef.setInput('actionIcon', 'pencil-simple-line');
    fixture.componentRef.setInput('actionLabel', 'Editar diagnóstico');
    const actionClick = jasmine.createSpy('actionClick');

    fixture.componentInstance.actionClick.subscribe(actionClick);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    button.click();

    expect(button.getAttribute('aria-label')).toBe('Editar diagnóstico');
    expect(actionClick).toHaveBeenCalledTimes(1);
  });
});
