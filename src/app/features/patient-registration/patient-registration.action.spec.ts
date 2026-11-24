import { TestBed } from '@angular/core/testing';

import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { AssistantConversationService } from '../../shared/services/assistant-conversation.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { type CreatePatientRequest, PatientCreationPort, PatientFieldError } from './patient-creation.port';
import { PatientRegistrationAction } from './patient-registration.action';

describe('PatientRegistrationAction (US-002-1-02)', () => {
  let create: jasmine.Spy<(request: CreatePatientRequest) => Promise<unknown>>;
  let flow: AssistantConversationService;
  let assistant: AiAssistantService;
  const texts = (): string[] => flow.messages().map(m => m.text);
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve));

  async function setup(
    hospitals: readonly { id: number; name: string }[] = [{ id: 7, name: 'Hospital A' }],
  ): Promise<void> {
    spyOnProperty(navigator, 'language').and.returnValue('pt-BR');
    create = jasmine.createSpy('create').and.resolveTo({});
    TestBed.configureTestingModule({
      providers: [
        { provide: PatientCreationPort, useValue: { create } },
        { provide: LinkedHospitalsReader, useValue: { read: (): Promise<unknown> => Promise.resolve(hospitals) } },
      ],
    });
    await TestBed.inject(HospitalContextService).load();
    flow = TestBed.inject(AssistantConversationService);
    assistant = TestBed.inject(AiAssistantService);
    assistant.openAction(TestBed.inject(PatientRegistrationAction).build());
  }

  it('opens as a conversation asking the full name first', async () => {
    await setup();

    expect(assistant.view()).toBe('conversation');
    expect(texts()).toEqual(['Me fale o nome completo do paciente']);
  });

  it('scenario 1: collects name, birth date and sex and creates the patient (MSG-04)', async () => {
    await setup();
    assistant.ask('Carlos Eduardo Matos');
    assistant.ask('15/09/1975');
    flow.choose(flow.options()[0]);
    flow.skip();
    await settle();

    expect(create).toHaveBeenCalledOnceWith({
      birthDate: '1975-09-15',
      fullName: 'Carlos Eduardo Matos',
      hospitalId: 7,
      sex: 'MALE',
    });

    expect(texts().at(-1)).toBe('Paciente cadastrado com sucesso.');
    expect(flow.finished()).toBeTrue();
  });

  it('sends the SAME when informed', async () => {
    await setup();
    assistant.ask('Ana');
    assistant.ask('01/01/2000');
    assistant.ask('feminino');
    assistant.ask('ABC-1');
    await settle();

    expect(create.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ medicalRecordNumber: 'ABC-1', sex: 'FEMALE' }),
    );
  });

  it('scenario 2: empty name shows MSG-01 and repeats the question', async () => {
    await setup();
    assistant.ask('   ');

    expect(texts().slice(-2)).toEqual(['Informe o nome completo do paciente.', 'Me fale o nome completo do paciente']);
    expect(flow.currentStep()?.id).toBe('fullName');
  });

  it('scenario 3: invalid sex shows MSG-03, repeats the question and keeps previous answers', async () => {
    await setup();
    assistant.ask('Ana');
    assistant.ask('01/01/2000');
    assistant.ask('talvez');

    expect(texts().slice(-2)).toEqual(['Selecione o sexo do paciente.', 'Qual o sexo do paciente?']);
    expect(flow.currentStep()?.id).toBe('sex');
    assistant.ask('masculino');
    assistant.ask('');
    await settle();

    expect(create.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ fullName: 'Ana' }));
  });

  it('scenario 4: 151-character name shows MSG-05', async () => {
    await setup();
    assistant.ask('a'.repeat(151));

    expect(texts().at(-2)).toBe('O nome completo deve ter no máximo 150 caracteres.');
    assistant.ask('a'.repeat(150));

    expect(flow.currentStep()?.id).toBe('birthDate');
  });

  it('scenario 5: future date shows MSG-02 and repeats the question', async () => {
    await setup();
    assistant.ask('Ana');
    assistant.ask('01/01/2999');

    expect(texts().slice(-2)).toEqual([
      'Informe uma data de nascimento válida.',
      'Qual a data de nascimento? (dd/mm/aaaa)',
    ]);
  });

  it('limits the SAME to 30 characters, repeating the question', async () => {
    await setup();
    assistant.ask('Ana');
    assistant.ask('01/01/2000');
    assistant.ask('masculino');
    assistant.ask('1'.repeat(31));

    expect(create).not.toHaveBeenCalled();
    expect(texts().at(-2)).toBe('O SAME deve ter no máximo 30 caracteres.');
  });

  it('does not send without an active hospital and allows trying again', async () => {
    await setup([]);
    assistant.ask('Ana');
    assistant.ask('01/01/2000');
    assistant.ask('masculino');
    assistant.ask('');
    await settle();

    expect(create).not.toHaveBeenCalled();
    expect(flow.canRetry()).toBeTrue();
    expect(texts().at(-1)).toBe('Não foi possível cadastrar o paciente. Tente novamente.');
  });
});

describe('PatientRegistrationAction server errors', () => {
  let flow: AssistantConversationService;
  let assistant: AiAssistantService;
  let create: jasmine.Spy;
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve));

  async function fill(error: unknown): Promise<void> {
    spyOnProperty(navigator, 'language').and.returnValue('pt-BR');
    create = jasmine.createSpy('create').and.rejectWith(error);
    TestBed.configureTestingModule({
      providers: [
        { provide: PatientCreationPort, useValue: { create } },
        {
          provide: LinkedHospitalsReader,
          useValue: { read: (): Promise<unknown> => Promise.resolve([{ id: 7, name: 'H' }]) },
        },
      ],
    });
    await TestBed.inject(HospitalContextService).load();
    flow = TestBed.inject(AssistantConversationService);
    assistant = TestBed.inject(AiAssistantService);
    assistant.openAction(TestBed.inject(PatientRegistrationAction).build());
    assistant.ask('Ana');
    assistant.ask('01/01/2000');
    assistant.ask('masculino');
    assistant.ask('');
    await settle();
  }

  it('422 goes back to the field question, server message first', async () => {
    await fill(new PatientFieldError('birthDate', 'MSG-02', 'Data inválida (servidor)'));

    expect(flow.currentStep()?.id).toBe('birthDate');
    expect(flow.messages().at(-2)?.text).toBe('Data inválida (servidor)');
    create.and.resolveTo({});
    assistant.ask('02/02/2000');
    await settle();

    expect(create).toHaveBeenCalledTimes(2);
    expect(flow.finished()).toBeTrue();
  });

  it('409 SAME em uso (US-002-1-04) mostra a MSG-07 e repete a pergunta do SAME', async () => {
    await fill(new PatientFieldError('medicalRecordNumber', 'MSG-07', 'Este SAME já está em uso: Maria.'));

    expect(flow.currentStep()?.id).toBe('medicalRecordNumber');
    expect(flow.messages().at(-2)?.text).toBe('Este SAME já está em uso: Maria.');
  });

  it('422 without server text uses the local message of the code', async () => {
    await fill(new PatientFieldError('fullName', 'MSG-05'));

    expect(flow.currentStep()?.id).toBe('fullName');
    expect(flow.messages().at(-2)?.text).toBe('O nome completo deve ter no máximo 150 caracteres.');
  });

  it('422 with an unknown code falls back to the generic error', async () => {
    await fill(new PatientFieldError('sex', 'OUTRO'));

    expect(flow.messages().at(-2)?.text).toBe('Não foi possível cadastrar o paciente. Tente novamente.');
  });

  it('other failures show the generic error and keep the answers for a retry', async () => {
    await fill(new Error('network'));

    expect(flow.canRetry()).toBeTrue();
    create.and.resolveTo({});
    flow.retry();
    await settle();

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ fullName: 'Ana', sex: 'MALE' }));
    expect(flow.finished()).toBeTrue();
  });
});
