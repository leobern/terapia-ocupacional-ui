import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { CardNotifyComponent } from './card-notify.component';

describe('CardNotifyComponent — eventos', () => {
  let fixture: ComponentFixture<CardNotifyComponent>;
  const replies = [
    { authorName: 'Dra. Ana', authorPhotoUrl: null, authorSpecialty: 'Nutróloga', text: 'Ok', time: '10:00' },
  ];
  const emitted: Record<string, number> = {};

  async function create(type: 'resume' | 'detail' | 'answer-open' | 'answering'): Promise<void> {
    await TestBed.configureTestingModule({ imports: [CardNotifyComponent] }).compileComponents();
    fixture = TestBed.createComponent(CardNotifyComponent);
    fixture.componentRef.setInput('authorName', 'Jairo');
    fixture.componentRef.setInput('authorSpecialty', 'Enfermeiro');
    fixture.componentRef.setInput('description', 'Texto');
    fixture.componentRef.setInput('time', '09:00');
    fixture.componentRef.setInput('actionAriaLabel', 'Responder');
    fixture.componentRef.setInput('type', type);
    fixture.componentRef.setInput('patientName', 'José');
    fixture.componentRef.setInput('replies', replies);
    for (const name of ['cardClick', 'answerClick', 'viewRepliesClick', 'collapseClick'] as const) {
      emitted[name] = 0;
      fixture.componentInstance[name].subscribe(() => emitted[name]++);
    }
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const click = (selector: string): void => (el().querySelector(selector) as HTMLElement).click();

  it('o balão de responder emite answerClick sem acionar o clique do card', async () => {
    await create('detail');
    click('.card-notify__side button');

    expect([emitted['answerClick'], emitted['cardClick']]).toEqual([1, 0]);
  });

  it('a tag de respostas emite viewRepliesClick sem acionar o clique do card', async () => {
    await create('detail');
    click('.card-notify__reply-tag');

    expect([emitted['viewRepliesClick'], emitted['cardClick']]).toEqual([1, 0]);
  });

  it('"Ver menos" emite collapseClick sem acionar o clique do card', async () => {
    await create('answer-open');
    click('.card-notify__collapse');

    expect([emitted['collapseClick'], emitted['cardClick']]).toEqual([1, 0]);
  });

  it('em modo answering o clique no card não emite nada', async () => {
    await create('answering');
    click('.card-notify');

    expect(emitted['cardClick']).toBe(0);
  });

  it('clicar no corpo do card pendente emite cardClick', async () => {
    await create('detail');
    click('.card-notify');

    expect(emitted['cardClick']).toBe(1);
  });
});
