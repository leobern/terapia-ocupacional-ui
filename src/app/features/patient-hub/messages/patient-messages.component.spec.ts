import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientRecord } from './patient-message.models';
import { PatientMessageSource } from './patient-message-source';
import { MESSAGES_LOAD_FAILED_HINT, PatientMessagesComponent } from './patient-messages.component';

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

  it('mostra só as observações (sem destinatário), com autor, data/hora e tipo em texto', () => {
    const cards = Array.from(el().querySelectorAll('[data-testid="record-card"]'));

    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Observação');
    expect(cards[0].textContent).toContain('Michelle · 21/11/26 09:05');
    expect(cards[0].textContent).toContain('conteúdo 2');
    expect(el().textContent).not.toContain('conteúdo 1');
  });

  it('recarrega quando o registro muda e mantém os cards se a leitura falhar', async () => {
    result = Promise.reject(new Error('offline'));
    fixture.componentRef.setInput('refreshKey', 1);
    await settle();

    expect(calls).toBe(2);
    expect(el().querySelectorAll('[data-testid="record-card"]').length).toBe(1);
    expect(el().textContent).toContain(MESSAGES_LOAD_FAILED_HINT);
  });

  it('sem observações a seção some (as mensagens ficam em "Mensagens")', async () => {
    result = Promise.resolve([record('1', [{ id: 5, name: 'Almira', specialty: 'Enfermeira' }])]);
    fixture.componentRef.setInput('refreshKey', 2);
    await settle();

    expect(el().querySelector('section')).toBeNull();
  });
});
