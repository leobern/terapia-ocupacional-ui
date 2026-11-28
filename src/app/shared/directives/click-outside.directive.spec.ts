import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClickOutsideDirective } from './click-outside.directive';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClickOutsideDirective],
  template: `
    <button type="button" class="trigger">abrir</button>
    <p class="outside">fora</p>
    @if (open()) {
      <ul class="list" appClickOutsideIgnore=".trigger" (appClickOutside)="open.set(false)">
        <li class="item">item</li>
      </ul>
    }
  `,
})
class HostComponent {
  readonly open = signal(true);
}

describe('ClickOutsideDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  });

  function click(selector: string): void {
    (host.querySelector(selector) as HTMLElement).click();
    fixture.detectChanges();
  }

  it('fecha ao clicar fora da lista', () => {
    click('.outside');

    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('não fecha ao clicar dentro da lista', () => {
    click('.item');

    expect(fixture.componentInstance.open()).toBe(true);
  });

  it('não fecha ao clicar no elemento ignorado (o botão que abre)', () => {
    click('.trigger');

    expect(fixture.componentInstance.open()).toBe(true);
  });

  it('ignora cliques cujo alvo não é um elemento', () => {
    document.dispatchEvent(new Event('click'));

    expect(fixture.componentInstance.open()).toBe(true);
  });
});
