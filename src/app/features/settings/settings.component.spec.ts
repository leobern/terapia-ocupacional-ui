import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let navigate: jasmine.Spy;

  beforeEach(() => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    TestBed.configureTestingModule({ imports: [SettingsComponent], providers: [provideRouter([])] });
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
  });

  it('Scenario 3: offers "Rever tutorial" and opens the tutorial', () => {
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector<HTMLButtonElement>('button.settings__item');

    expect(el.querySelector('h1')?.textContent).toContain('Configurações');
    expect(button?.textContent).toContain('Rever tutorial');

    button?.click();

    expect(navigate).toHaveBeenCalledWith('/settings/tutorial');
  });

  it('opens the hospital links screen', () => {
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button.settings__item');

    buttons[1].click();

    expect(navigate).toHaveBeenCalledWith('/hospital-links');
  });
});
