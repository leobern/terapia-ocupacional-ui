import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FieldCardComponent } from './field-card.component';

describe('FieldCardComponent', () => {
  let fixture: ComponentFixture<FieldCardComponent>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const set = (name: string, value: unknown): void => fixture.componentRef.setInput(name, value);

  beforeEach(() => {
    fixture = TestBed.createComponent(FieldCardComponent);
    set('label', 'Peso');
    set('inputId', 'x-weight');
    fixture.detectChanges();
  });

  it('mostra o título ligado ao campo e a unidade dentro dele', () => {
    set('unit', 'kg');
    fixture.detectChanges();

    expect(root().querySelector('label[for="x-weight"]')?.textContent).toContain('Peso');
    expect(root().querySelector('.field-card__unit')?.textContent).toContain('kg');
  });

  it('avisa a digitação', () => {
    const values: string[] = [];

    fixture.componentInstance.valueChange.subscribe(v => values.push(v));
    const input = root().querySelector('input') as HTMLInputElement;

    input.value = '51';
    input.dispatchEvent(new Event('input'));

    expect(values).toEqual(['51']);
  });

  it('com linhas vira área de texto com limite de caracteres', () => {
    set('rows', 6);
    set('maxLength', 1000);
    fixture.detectChanges();
    const area = root().querySelector('textarea') as HTMLTextAreaElement;

    expect(area.maxLength).toBe(1000);
    expect(root().querySelector('.field-card__field--area')).not.toBeNull();

    const values: string[] = [];

    fixture.componentInstance.valueChange.subscribe(v => values.push(v));
    area.value = 'texto';
    area.dispatchEvent(new Event('input'));

    expect(values).toEqual(['texto']);
  });

  it('com opções vira seleção', () => {
    set('options', ['A', 'B']);
    set('placeholder', 'Selecione');
    set('value', 'B');
    fixture.detectChanges();
    const select = root().querySelector('select') as HTMLSelectElement;

    expect(select.options.length).toBe(3);
    expect(select.value).toBe('B');

    const values: string[] = [];

    fixture.componentInstance.valueChange.subscribe(v => values.push(v));
    select.value = 'A';
    select.dispatchEvent(new Event('change'));

    expect(values).toEqual(['A']);
  });

  it('o erro troca a legenda e marca o campo', () => {
    set('caption', 'Legenda');
    fixture.detectChanges();

    expect(root().textContent).toContain('Legenda');

    set('error', 'Informe o peso.');
    fixture.detectChanges();

    expect(root().textContent).toContain('Informe o peso.');
    expect(root().textContent).not.toContain('Legenda');
    expect(root().querySelector('.field-card__field--error')).not.toBeNull();
  });
});
