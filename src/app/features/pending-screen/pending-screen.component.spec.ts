import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';

import { PendingScreenComponent } from './pending-screen.component';

describe('PendingScreenComponent', () => {
  it('shows the route screen name', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { data: { screen: 'login' } } } }],
    });
    const fixture = TestBed.createComponent(PendingScreenComponent);

    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('login');
  });

  it('falls back to empty', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { data: {} } } }],
    });
    const fixture = TestBed.createComponent(PendingScreenComponent);

    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toBe('');
  });

  it('shows the notice handed over by the navigation (MSG-01)', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: { screen: 'login' } } } },
        {
          provide: Router,
          useValue: { getCurrentNavigation: (): unknown => ({ extras: { state: { notice: 'Sua sessão expirou.' } } }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(PendingScreenComponent);

    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toBe(
      'Sua sessão expirou.',
    );
  });
});
