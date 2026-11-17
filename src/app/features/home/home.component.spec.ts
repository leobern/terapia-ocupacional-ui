import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeComponent, HomeLoadState } from './home.component';
import { HospitalContextService } from './hospital-context.service';
import { LinkedHospital, LinkedHospitalsReader } from './linked-hospitals';
import { LocalProfessionalProfileReader } from './local-professional-profile-reader';
import { ProfessionalProfileReader } from './professional-profile';

const HOSPITALS: LinkedHospital[] = [
  { id: 'a', name: 'Hospital A' },
  { id: 'b', name: 'Hospital B' },
];

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  async function setup(hospitals: readonly LinkedHospital[]): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: ProfessionalProfileReader, useClass: LocalProfessionalProfileReader },
        { provide: LinkedHospitalsReader, useValue: { read: (): readonly LinkedHospital[] => hospitals } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const combobox = (): HTMLElement => el().querySelector('[role="combobox"]') as HTMLElement;
  const options = (): HTMLElement[] => Array.from(el().querySelectorAll('[role="option"]'));

  // Acessibilidade (Princípio X): a rota precisa de um marco de navegação e de um
  // título de nível 1 para leitor de tela ancorar a página.
  it('renders a single <main> landmark with a level-1 heading', async () => {
    await setup([HOSPITALS[0]]);
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelectorAll('main').length).toBe(1);
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('main.home h1')?.textContent?.trim()).toBe('Conductia');
  });

  (['loading', 'success', 'error'] as HomeLoadState[]).forEach(state => {
    it(`keeps the same header element visible in the ${state} state`, async () => {
      await setup([HOSPITALS[0]]);
      const before = fixture.nativeElement.querySelector('.home-header');

      fixture.componentInstance.loadState.set(state);
      fixture.detectChanges();
      const after = fixture.nativeElement.querySelector('.home-header');

      expect(after).toBeTruthy();
      expect(after).toBe(before);
      expect(after.textContent).toContain('Michelle Franklin');
    });
  });

  it('does not mount the bottom nav bar itself (the shell owns it)', async () => {
    await setup([HOSPITALS[0]]);
    expect(fixture.nativeElement.querySelector('app-bottom-nav-bar')).toBeNull();
  });

  describe('single hospital', () => {
    beforeEach(() => setup([HOSPITALS[0]]));

    it('shows the hospital name in an accessibly named selector', () => {
      expect(combobox().textContent?.trim()).toBe('Hospital A');
      expect(combobox().getAttribute('aria-label')).toBe('Hospital');
    });

    it('does not open an option list', () => {
      combobox().click();
      fixture.detectChanges();

      expect(options().length).toBe(0);
    });
  });

  describe('multiple hospitals', () => {
    beforeEach(() => setup(HOSPITALS));

    it('lists linked hospitals and marks the current one', () => {
      combobox().click();
      fixture.detectChanges();

      expect(options().map(o => o.textContent?.trim())).toEqual(['Hospital A', 'Hospital B']);
      expect(options().map(o => o.getAttribute('aria-selected'))).toEqual(['true', 'false']);
      expect(combobox().getAttribute('aria-expanded')).toBe('true');
    });

    it('switches the context when choosing another hospital', () => {
      combobox().click();
      fixture.detectChanges();
      options()[1].click();
      fixture.detectChanges();

      expect(combobox().textContent?.trim()).toBe('Hospital B');
      expect(TestBed.inject(HospitalContextService).selected()?.id).toBe('b');
      expect(options().length).toBe(0);
    });

    it('closes without changing when choosing the current hospital', () => {
      combobox().click();
      fixture.detectChanges();
      options()[0].click();
      fixture.detectChanges();

      expect(TestBed.inject(HospitalContextService).selected()?.id).toBe('a');
      expect(options().length).toBe(0);
    });

    it('supports keyboard: arrows move focus, Enter selects, Escape closes', () => {
      combobox().click();
      fixture.detectChanges();
      options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

      expect(document.activeElement).toBe(options()[1]);

      options()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(options().length).toBe(0);

      combobox().click();
      fixture.detectChanges();
      options()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();

      expect(combobox().textContent?.trim()).toBe('Hospital B');
    });

    it('toggles the list closed on a second trigger', () => {
      combobox().click();
      fixture.detectChanges();
      combobox().click();
      fixture.detectChanges();

      expect(options().length).toBe(0);
    });
  });
});
