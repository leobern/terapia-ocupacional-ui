import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientRecord } from './patient-message.models';
import { PatientMessageSource } from './patient-message-source';
import { MESSAGES_EMPTY_TEXT, MESSAGES_LOAD_FAILED_HINT, PatientMessagesComponent } from './patient-messages.component';

const record = (id: string, recipients: PatientRecord['recipients']): PatientRecord => ({
  at: new Date(2026, 10, 21, 9, 5).toISOString(),
  author: 'Michelle',
  content: `conteúdo ${id}`,
  id,
  patientId: 'p1',
  recipients,
  viaAudio: false,
});

describe('PatientMessagesComponent', () => {
  let fixture: ComponentFixture<PatientMessagesComponent>;
  let result: Promise<readonly PatientRecord[]>;
  let calls: number;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    calls = 0;
    result = Promise.resolve([record('1', [{ id: 5, name: 'Almira', specialty: 'Enfermeira' }]), record('2', [])]);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PatientMessageSource,
          useValue: {
            list: (): Promise<readonly PatientRecord[]> => {
              calls++;

              return result;
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(PatientMessagesComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    await settle();
  });

  it('um card por registro, com autor, data/hora e tipo em texto; destinatários só na mensagem', () => {
    const cards = Array.from(el().querySelectorAll('[data-testid="record-card"]'));

    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Mensagem');
    expect(cards[0].textContent).toContain('Michelle · 21/11/2026 09:05');
    expect(cards[0].textContent).toContain('Para: Almira');
    expect(cards[1].textContent).toContain('Observação');
    expect(cards[1].textContent).not.toContain('Para:');
  });

  it('recarrega quando o registro muda e mantém os cards se a leitura falhar', async () => {
    result = Promise.reject(new Error('offline'));
    fixture.componentRef.setInput('refreshKey', 1);
    await settle();

    expect(calls).toBe(2);
    expect(el().querySelectorAll('[data-testid="record-card"]').length).toBe(2);
    expect(el().textContent).toContain(MESSAGES_LOAD_FAILED_HINT);
  });

  it('sem registros mostra o texto vazio', async () => {
    result = Promise.resolve([]);
    fixture.componentRef.setInput('refreshKey', 2);
    await settle();

    expect(el().querySelector('[data-testid="records-empty"]')?.textContent).toContain(MESSAGES_EMPTY_TEXT);
  });
});
