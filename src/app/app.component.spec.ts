import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
  });

  it('should create the app', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('opens the mobile menu when the bottom-nav-bar menu button is clicked', () => {
    const menuButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'app-bottom-nav-bar button[aria-label="Abrir menu"]',
    );

    menuButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-nav-menu').classList).toContain('nav-menu--open');
  });

  it('closes the mobile menu when nav-menu emits closed', () => {
    fixture.componentInstance.menuOpen.set(true);
    fixture.detectChanges();

    const navMenu = fixture.debugElement.query(el => el.name === 'app-nav-menu');

    navMenu.triggerEventHandler('closed');
    fixture.detectChanges();

    expect(fixture.componentInstance.menuOpen()).toBe(false);
  });

  it('opens the AI chat surface when the nav-menu logo is clicked', () => {
    const navMenu = fixture.debugElement.query(el => el.name === 'app-nav-menu');

    navMenu.triggerEventHandler('logoClick');
    fixture.detectChanges();

    expect(fixture.componentInstance.aiAssistant.isOpen()).toBe(true);
  });

  it('opens the AI chat surface when the bottom-nav-bar AI button is clicked', () => {
    const aiButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'app-bottom-nav-bar button[aria-label="Abrir assistente de IA"]',
    );

    aiButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.aiAssistant.isOpen()).toBe(true);
  });

  it('renders app-bottom-sheet (not app-drawer) when the viewport is not desktop', () => {
    expect(fixture.nativeElement.querySelector('app-bottom-sheet')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-drawer')).toBeFalsy();
  });

  it('renders app-drawer (not app-bottom-sheet) when the viewport is desktop', () => {
    fixture.componentInstance.viewportBreakpoint.isDesktopSignal.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-drawer')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-bottom-sheet')).toBeFalsy();
  });

  it('closes the AI chat surface when the bottom-sheet emits closed', () => {
    fixture.componentInstance.aiAssistant.openPanel();
    fixture.detectChanges();

    const bottomSheet = fixture.debugElement.query(el => el.name === 'app-bottom-sheet');

    bottomSheet.triggerEventHandler('closed');
    fixture.detectChanges();

    expect(fixture.componentInstance.aiAssistant.isOpen()).toBe(false);
  });

  it('onAiShortcut and onAiSend do not throw (sem serviço de conversa com a IA ainda)', () => {
    expect(() => fixture.componentInstance.onAiShortcut({ id: 'x', label: 'X' })).not.toThrow();
    expect(() => fixture.componentInstance.onAiSend('mensagem')).not.toThrow();
  });
});
