import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AppComponent } from './app.component';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([
          { component: DummyComponent, data: { hideShell: true }, path: 'splash' },
          { component: DummyComponent, path: 'home' },
        ]),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    expect(app).toBeTruthy();
  });

  it('hides the navigation shell on routes flagged hideShell and shows it elsewhere', async () => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(AppComponent);
    const el = fixture.nativeElement as HTMLElement;

    await router.navigateByUrl('/splash');
    fixture.detectChanges();

    expect(el.querySelector('app-nav-menu')).toBeNull();
    expect(el.querySelector('app-bottom-nav-bar')).toBeNull();

    await router.navigateByUrl('/home');
    fixture.detectChanges();

    expect(el.querySelector('app-nav-menu')).not.toBeNull();
    expect(el.querySelector('app-bottom-nav-bar')).not.toBeNull();
  });
});
