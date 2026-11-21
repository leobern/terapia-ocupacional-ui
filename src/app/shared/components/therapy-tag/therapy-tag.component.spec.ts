import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TherapyTagComponent } from './therapy-tag.component';

describe('TherapyTagComponent', () => {
  let fixture: ComponentFixture<TherapyTagComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TherapyTagComponent);
    fixture.componentRef.setInput('label', 'VO · NE');
    fixture.detectChanges();
  });

  it('mostra o rótulo e usa o tom neutro por padrão', () => {
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('VO · NE');
    expect(el.classList).toContain('therapy-tag--neutral');
  });

  it('aplica o tom ativo', () => {
    fixture.componentRef.setInput('tone', 'active');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).classList).toContain('therapy-tag--active');
  });
});
