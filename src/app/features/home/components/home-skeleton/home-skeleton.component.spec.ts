import { TestBed } from '@angular/core/testing';

import { HomeSkeletonComponent } from './home-skeleton.component';

describe('HomeSkeletonComponent', () => {
  it('renders the tag placeholder and four card placeholders, hidden from assistive tech', () => {
    const fixture = TestBed.createComponent(HomeSkeletonComponent);

    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('.home-skeleton')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelectorAll('.home-skeleton__block--tag').length).toBe(1);
    expect(el.querySelectorAll('.home-skeleton__block--card').length).toBe(4);
  });
});
