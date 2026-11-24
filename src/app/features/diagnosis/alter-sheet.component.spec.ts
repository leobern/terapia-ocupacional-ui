import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AlterSheetComponent } from './alter-sheet.component';
import { GlimResult } from './diagnosis.models';

const RESULT: GlimResult = {
  criteria: {
    inflammation: 'positive',
    'low-bmi': 'negative',
    'low-muscle-mass': 'not-evaluated',
    'reduced-intake': 'positive',
    'weight-loss': 'positive',
  },
  outcome: 'confirmed',
  staging: 'moderate',
};

describe('AlterSheetComponent', () => {
  let fixture: ComponentFixture<AlterSheetComponent>;
  let saved: GlimResult[];
  let cancelled: number;

  beforeEach(() => {
    saved = [];
    cancelled = 0;
    fixture = TestBed.createComponent(AlterSheetComponent);
    fixture.componentRef.setInput('result', RESULT);
    fixture.componentRef.setInput('open', false);
    fixture.componentInstance.saved.subscribe(r => saved.push(r));
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);
    fixture.detectChanges();
  });

  const field = (name: string): HTMLSelectElement => {
    const el = fixture.nativeElement.querySelector(`select[data-field="${name}"], select[data-criterion="${name}"]`);

    if (!(el instanceof HTMLSelectElement)) {
      throw new Error(name);
    }

    return el;
  };
  const choose = (name: string, value: string): void => {
    const el = field(name);

    el.value = value;
    el.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const save = (): void => {
    fixture.nativeElement.querySelector('.alter__actions app-button:first-child button').click();
  };
  const dialog = (): HTMLDialogElement => fixture.nativeElement.querySelector('dialog');
  const open = (): void => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  };

  it('abre com os valores atuais e fecha quando open volta a false', () => {
    open();

    expect(dialog().open).toBeTrue();
    expect(fixture.nativeElement.querySelector('select[data-field="outcome"]').value).toBe('confirmed');
    expect(fixture.nativeElement.querySelector('select[data-field="staging"]').value).toBe('moderate');
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();

    expect(dialog().open).toBeFalse();
  });

  it('salvar emite o rascunho sem alterar nada além do editado', () => {
    open();
    choose('low-bmi', 'positive');
    choose('staging', 'severe');
    save();

    expect(saved[0].criteria['low-bmi']).toBe('positive');
    expect(saved[0].staging).toBe('severe');
    expect(saved[0].outcome).toBe('confirmed');
  });

  it('resultado diferente de confirmada limpa o estadiamento com explicação', () => {
    open();
    choose('outcome', 'indeterminate');

    expect(fixture.nativeElement.querySelector('.alter__hint').textContent).toContain('foi limpo');
    choose('outcome', 'excluded');
    save();

    expect(saved[0].staging).toBeNull();
  });

  it('clique no fundo e Esc cancelam; clique dentro não', () => {
    open();
    dialog().querySelector<HTMLElement>('.alter__title')?.click();

    expect(cancelled).toBe(0);
    dialog().click();

    expect(cancelled).toBe(1);
    const event = new Event('cancel', { cancelable: true });

    dialog().dispatchEvent(event);

    expect(event.defaultPrevented).toBeTrue();
    expect(cancelled).toBe(2);
  });
});
