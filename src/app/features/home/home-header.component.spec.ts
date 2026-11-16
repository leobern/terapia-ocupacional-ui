import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeHeaderComponent } from './home-header.component';
import { NOW, ProfessionalProfile, ProfessionalProfileReader } from './professional-profile';

describe('HomeHeaderComponent', () => {
  function setup(profile: ProfessionalProfile): HTMLElement {
    TestBed.configureTestingModule({
      imports: [HomeHeaderComponent],
      providers: [
        { provide: ProfessionalProfileReader, useValue: { read: (): ProfessionalProfile => profile } },
        { provide: NOW, useValue: (): Date => new Date(2026, 10, 16, 10) },
      ],
    });
    const fixture: ComponentFixture<HomeHeaderComponent> = TestBed.createComponent(HomeHeaderComponent);

    fixture.detectChanges();

    return fixture.nativeElement;
  }

  it('shows the name and the full date in pt-BR', () => {
    const el = setup({ name: 'Michelle Franklin' });

    expect(el.querySelector('.home-header__name')?.textContent).toBe('Michelle Franklin');
    expect(el.querySelector('.home-header__date')?.textContent).toBe('segunda-feira, 16 de novembro de 2026');
  });

  it('shows the photo when available', () => {
    const el = setup({ name: 'Michelle Franklin', photoUrl: 'foto.png' });

    expect(el.querySelector('img')?.getAttribute('src')).toBe('foto.png');
  });

  it('falls back to two initials without photo', () => {
    const el = setup({ name: 'Michelle Franklin' });

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.avatar__initials')?.textContent).toBe('MF');
  });

  it('falls back to one initial for a single name', () => {
    const el = setup({ name: 'Michelle' });

    expect(el.querySelector('.avatar__initials')?.textContent).toBe('M');
  });
});
