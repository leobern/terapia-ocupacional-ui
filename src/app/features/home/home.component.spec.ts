import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeComponent, HomeLoadState } from './home.component';
import { LocalProfessionalProfileReader } from './local-professional-profile-reader';
import { ProfessionalProfileReader } from './professional-profile';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [{ provide: ProfessionalProfileReader, useClass: LocalProfessionalProfileReader }],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
  });

  // Acessibilidade (Princípio X): a rota precisa de um marco de navegação e de um
  // título de nível 1 para leitor de tela ancorar a página.
  it('renders a single <main> landmark with a level-1 heading', () => {
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('main').length).toBe(1);
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('main.home h1')?.textContent?.trim()).toBe('Conductia');
  });

  (['loading', 'success', 'error'] as HomeLoadState[]).forEach(state => {
    it(`keeps the same header element visible in the ${state} state`, () => {
      const before = fixture.nativeElement.querySelector('.home-header');

      fixture.componentInstance.loadState.set(state);
      fixture.detectChanges();
      const after = fixture.nativeElement.querySelector('.home-header');

      expect(after).toBeTruthy();
      expect(after).toBe(before);
      expect(after.textContent).toContain('Michelle Franklin');
    });
  });
});
