import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

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
});
