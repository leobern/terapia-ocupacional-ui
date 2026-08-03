import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
  });

  // Acessibilidade (Princípio X): a rota precisa de um marco de navegação e de um
  // título de nível 1 para leitor de tela ancorar a página — mesmo sendo stub.
  it('renders a <main> landmark with a level-1 heading', () => {
    const main: HTMLElement = fixture.nativeElement.querySelector('main.home');

    expect(main).toBeTruthy();
    expect(main.querySelector('h1')?.textContent?.trim()).toBe('Conductia');
  });
});
