import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EmptyStateComponent] }).compileComponents();
    fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('title', 'Sem nada');
    fixture.componentRef.setInput('actionLabel', 'Criar');
    fixture.detectChanges();
  });

  it('mostra título, ilustração e o CTA; sem texto de apoio quando não informado', () => {
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('h2')?.textContent).toContain('Sem nada');
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('.empty-state__hint')).toBeNull();
    expect(el.querySelector('button')?.textContent).toContain('Criar');
  });

  it('mostra o texto de apoio e emite action ao tocar no CTA', () => {
    const action = jasmine.createSpy('action');

    fixture.componentRef.setInput('hint', 'Explicação');
    fixture.componentInstance.action.subscribe(action);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    expect(fixture.nativeElement.querySelector('.empty-state__hint')?.textContent).toContain('Explicação');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('o cartão tem 600px no máximo e 40px de padding', () => {
    const host = fixture.nativeElement as HTMLElement;
    const card = host.querySelector('.empty-state') as HTMLElement;

    expect(getComputedStyle(host).maxWidth).toBe('600px');
    expect(getComputedStyle(card).paddingTop).toBe('40px');
  });
});
