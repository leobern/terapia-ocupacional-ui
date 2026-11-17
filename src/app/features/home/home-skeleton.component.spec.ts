import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeSkeletonComponent } from './home-skeleton.component';

describe('HomeSkeletonComponent', () => {
  let root: HTMLElement;
  let fixture: ComponentFixture<HomeSkeletonComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(HomeSkeletonComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    root = fixture.nativeElement;
  });

  it('announces a busy status to assistive technology', () => {
    const status = root.querySelector('[role="status"]');

    expect(status?.getAttribute('aria-busy')).toBe('true');
    expect(status?.getAttribute('aria-label')).toBeTruthy();
  });

  it('renders the select skeleton followed by the grid', () => {
    expect(root.querySelectorAll('.skeleton--select').length).toBe(1);
    expect(root.querySelector('.home-skeleton__grid')).toBeTruthy();
  });

  it('puts the patients card first in a two-column grid', () => {
    const cards = root.querySelectorAll('.home-skeleton__grid .skeleton');
    const grid = getComputedStyle(root.querySelector('.home-skeleton__grid') as Element);

    expect(cards[0].classList).toContain('skeleton--card-patients');
    expect(root.querySelectorAll('.skeleton--card-notify').length).toBeGreaterThan(0);
    expect(grid.gridTemplateColumns.split(' ').length).toBe(2);
  });
});
