import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { ScrollRevealDirective } from './scroll-reveal.directive';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollRevealDirective],
  template: `<div appScrollReveal [hideAfterMs]="300"></div>`,
})
class HostComponent {}

describe('ScrollRevealDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  const el = (): HTMLElement => fixture.nativeElement.querySelector('div');

  beforeEach(() => {
    jasmine.clock().install();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  afterEach(() => jasmine.clock().uninstall());

  it('começa sem a marca; rolar liga `data-scrolling` e ela some depois do tempo sem rolar', () => {
    expect(el().dataset['scrolling']).toBeUndefined();

    el().dispatchEvent(new Event('scroll'));

    expect(el().dataset['scrolling']).toBe('true');

    jasmine.clock().tick(299);

    expect(el().dataset['scrolling']).toBe('true');

    jasmine.clock().tick(1);

    expect(el().dataset['scrolling']).toBeUndefined();
  });

  it('rolar de novo antes do fim reinicia o tempo', () => {
    el().dispatchEvent(new Event('scroll'));
    jasmine.clock().tick(200);
    el().dispatchEvent(new Event('scroll'));
    jasmine.clock().tick(200);

    expect(el().dataset['scrolling']).toBe('true');

    jasmine.clock().tick(100);

    expect(el().dataset['scrolling']).toBeUndefined();
  });

  it('destruir limpa o temporizador sem erro', () => {
    el().dispatchEvent(new Event('scroll'));

    expect(() => fixture.destroy()).not.toThrow();
  });
});
