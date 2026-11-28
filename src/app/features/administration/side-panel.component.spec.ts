import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SidePanelComponent } from './side-panel.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SidePanelComponent],
  template: `
    <app-side-panel title="Título" description="Descrição" [open]="open()" (closed)="closes.update(n => n + 1)">
      <p panelBody>corpo</p>
      <button panelFooter type="button">ação</button>
    </app-side-panel>
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly closes = signal(0);
}

describe('SidePanelComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('fechado não renderiza nada', () => {
    expect(el.querySelector('.side-panel')).toBeNull();
  });

  it('aberto mostra título, descrição, corpo e rodapé projetados', async () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.querySelector('.side-panel__title')?.textContent).toBe('Título');
    expect(el.querySelector('.side-panel__description')?.textContent).toBe('Descrição');
    expect(el.querySelector('.side-panel__body')?.textContent).toContain('corpo');
    expect(el.querySelector('.side-panel__footer button')).not.toBeNull();
    expect(el.querySelector('.side-panel')?.getAttribute('role')).toBe('dialog');
  });

  it('fecha pelo X, pelo scrim e pelo Esc', () => {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    (el.querySelector('.side-panel__header app-icon-button') as HTMLElement).click();
    (el.querySelector('.side-panel__scrim') as HTMLElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(fixture.componentInstance.closes()).toBe(3);
  });

  it('Esc com o painel fechado não faz nada', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(fixture.componentInstance.closes()).toBe(0);
  });
});
