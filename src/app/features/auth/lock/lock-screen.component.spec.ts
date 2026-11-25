import { TestBed } from '@angular/core/testing';

import { LockScreenComponent } from './lock-screen.component';

describe('LockScreenComponent', () => {
  it('shows the locked message and no clinical data', () => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    const fixture = TestBed.createComponent(LockScreenComponent);

    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('App bloqueado');
    expect(text).not.toMatch(/paciente|leito/i);
  });
});
