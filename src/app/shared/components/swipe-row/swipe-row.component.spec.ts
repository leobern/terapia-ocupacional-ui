import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SwipeRowComponent } from './swipe-row.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SwipeRowComponent],
  template: `
    <app-swipe-row
      actionLabel="Encerrar"
      actionAriaLabel="Encerrar Ana"
      [disabled]="disabled"
      (triggered)="count = count + 1"
    >
      <button type="button" class="inner" (click)="clicks = clicks + 1">Ana</button>
    </app-swipe-row>
  `,
})
class HostComponent {
  disabled = false;
  count = 0;
  clicks = 0;
}

describe('SwipeRowComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const el = (sel: string): HTMLElement => fixture.nativeElement.querySelector(sel) as HTMLElement;
  const ptr = (type: string, x: number): void => {
    el('.swipe-row__content').dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x }));
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('completa o gesto ao arrastar além do limite e recolhe a linha', () => {
    ptr('pointerdown', 300);
    ptr('pointermove', 200);

    expect(el('.swipe-row__content').style.transform).toBe('translateX(-100px)');
    expect(el('.swipe-row__action--revealed')).not.toBeNull();
    ptr('pointerup', 200);

    expect(fixture.componentInstance.count).toBe(1);
    expect(el('.swipe-row__content').style.transform).toBe('translateX(0px)');
  });

  it('limita o arrasto à largura da ação', () => {
    ptr('pointerdown', 300);
    ptr('pointermove', 0);

    expect(el('.swipe-row__content').style.transform).toBe('translateX(-110px)');
  });

  it('soltar antes do limite recolhe sem disparar', () => {
    ptr('pointerdown', 300);
    ptr('pointermove', 270);
    ptr('pointerup', 270);

    expect(fixture.componentInstance.count).toBe(0);
  });

  it('ignora arrasto para a direita e movimento sem toque', () => {
    ptr('pointermove', 100);
    ptr('pointerup', 100);
    ptr('pointerdown', 100);
    ptr('pointermove', 200);
    ptr('pointerup', 200);

    expect(fixture.componentInstance.count).toBe(0);
  });

  it('o clique logo após arrastar não chega ao conteúdo; o toque simples chega', () => {
    el('.inner').click();

    expect(fixture.componentInstance.clicks).toBe(1);
    ptr('pointerdown', 300);
    ptr('pointermove', 200);
    ptr('pointerup', 200);
    el('.inner').click();

    expect(fixture.componentInstance.clicks).toBe(1);
    el('.inner').click();

    expect(fixture.componentInstance.clicks).toBe(2);
  });

  it('a ação é um botão com nome acessível; clicar dispara', () => {
    const action = el('.swipe-row__action');

    expect(action.getAttribute('aria-label')).toBe('Encerrar Ana');
    action.click();

    expect(fixture.componentInstance.count).toBe(1);
  });

  it('foco por teclado revela a ação e o blur recolhe', () => {
    const action = el('.swipe-row__action');

    action.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();

    expect(el('.swipe-row__action--revealed')).not.toBeNull();
    action.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(el('.swipe-row__action--revealed')).toBeNull();
  });

  it('desabilitado: sem ação e sem gesto', () => {
    fixture.componentInstance.disabled = true;
    fixture.changeDetectorRef.markForCheck();
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.disabled = true;
    fixture.detectChanges();
    ptr('pointerdown', 300);
    ptr('pointermove', 100);
    ptr('pointerup', 100);

    expect(el('.swipe-row__action')).toBeNull();
    expect(fixture.componentInstance.count).toBe(0);
  });
});
