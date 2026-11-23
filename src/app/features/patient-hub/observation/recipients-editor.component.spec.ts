import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Recipients, TeamMember } from './observation.models';
import { RecipientsEditorComponent } from './recipients-editor.component';

const TEAM: readonly TeamMember[] = [
  { group: 'medicos', id: 1, name: 'Ana' },
  { group: 'enfermagem', id: 2, name: 'Carla' },
];

describe('RecipientsEditorComponent', () => {
  let fixture: ComponentFixture<RecipientsEditorComponent>;
  let emitted: Recipients[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(RecipientsEditorComponent);
    fixture.componentRef.setInput('team', TEAM);
    fixture.componentRef.setInput('value', { group: 'medicos', people: [] });
    emitted = [];
    fixture.componentInstance.changed.subscribe(v => emitted.push(v));
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('emite a troca de grupo, inclusive "nenhum"', () => {
    const select = (fixture.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;

    select.value = 'enfermagem';
    select.dispatchEvent(new Event('change'));
    select.value = '';
    select.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([
      { group: 'enfermagem', people: [] },
      { group: null, people: [] },
    ]);
  });

  it('marca e desmarca pessoas', () => {
    const [first] = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input'));

    first.click();
    fixture.componentRef.setInput('value', { group: 'medicos', people: [TEAM[0]] });
    fixture.detectChanges();
    first.click();

    expect(emitted[0].people).toEqual([TEAM[0]]);
    expect(emitted[1].people).toEqual([]);
  });
});
