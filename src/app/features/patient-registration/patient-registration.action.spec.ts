import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { AssistantConversationService } from '../../shared/services/assistant-conversation.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { type CreateInternacaoRequest, InternacaoCreationPort, InternacaoFieldError } from './internacao-creation.port';
import { type CreatePatientRequest, PatientCreationPort, PatientFieldError } from './patient-creation.port';
import { PatientRegistrationAction } from './patient-registration.action';

describe('PatientRegistrationAction (US-002-1-02)', () => {
  let create: jasmine.Spy<(request: CreatePatientRequest) => Promise<unknown>>;
  let navigate: jasmine.Spy;
  let flow: AssistantConversationService;
  let assistant: AiAssistantService;
  const texts = (): string[] => flow.messages().map(m => m.text);
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve));

  async function setup(
    hospitals: readonly { id: number; name: string }[] = [{ id: 7, name: 'Hospital A' }],
  ): Promise<void> {
    spyOnProperty(navigator, 'language').and.returnValue('pt-BR');
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    create = jasmine.createSpy('create').and.resolveTo({ id: 42 });
    TestBed.configureTestingModule({
      providers: [
        { provide: PatientCreationPort, useValue: { create } },
        { provide: Router, useValue: { navigate } },
        { provide: InternacaoCreationPort, useValue: { create: (): Promise<unknown> => Promise.resolve({}) } },
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

  it('ao cadastrar o paciente, leva à tela dele para o médico fazer a avaliação clínica', async () => {
    await setup();
    assistant.ask('Carlos Eduardo Matos');
    assistant.ask('15/09/1975');
    flow.choose(flow.options()[0]);
    flow.skip();
    assistant.ask('não');
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/patients', 42], { queryParams: { avaliar: '1' } });
  });

  it('scenario 1: collects name, birth date and sex and creates the patient (MSG-04)', async () => {
    await setup();
    assistant.ask('Carlos Eduardo Matos');
    assistant.ask('15/09/1975');
    flow.choose(flow.options()[0]);
    flow.skip();
    assistant.ask('não');
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
    assistant.ask('não');
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
    assistant.ask('não');
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
    assistant.ask('não');
    await settle();

    expect(create).not.toHaveBeenCalled();
    expect(flow.canRetry()).toBeTrue();
    expect(texts().at(-1)).toBe('Não foi possível cadastrar o paciente. Tente novamente.');
  });
});

describe('PatientRegistrationAction admit question (US-002-1-05)', () => {
  let flow: AssistantConversationService;
  let assistant: AiAssistantService;
  let create: jasmine.Spy;
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve));

  async function toAdmitQuestion(): Promise<void> {
    spyOnProperty(navigator, 'language').and.returnValue('pt-BR');
    create = jasmine.createSpy('create').and.resolveTo({ id: 42 });
    TestBed.configureTestingModule({
      providers: [
        { provide: PatientCreationPort, useValue: { create } },
        { provide: Router, useValue: { navigate: (): Promise<boolean> => Promise.resolve(true) } },
        { provide: InternacaoCreationPort, useValue: { create: (): Promise<unknown> => Promise.resolve({}) } },
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
  }

  it('scenario 1: asks whether to admit after the basic data, with Sim/Não options', async () => {
    await toAdmitQuestion();

    expect(create).not.toHaveBeenCalled();
    expect(flow.messages().at(-1)?.text).toBe('Deseja internar o paciente agora?');
    expect(flow.options().map(o => o.label)).toEqual(['Sim', 'Não']);
  });

  it('scenarios 2 and 3: "não" saves only the fixed data and asks nothing else', async () => {
    await toAdmitQuestion();
    flow.choose(flow.options()[1]);
    await settle();

    expect(create).toHaveBeenCalledOnceWith({
      birthDate: '2000-01-01',
      fullName: 'Ana',
      hospitalId: 7,
      sex: 'MALE',
    });

    expect(flow.finished()).toBeTrue();
    expect(flow.currentStep()).toBeNull();
    expect(flow.messages().at(-1)?.text).toBe('Paciente cadastrado com sucesso.');
  });

  it('"sim" asks the admission questions in order, all skippable', async () => {
    await toAdmitQuestion();
    assistant.ask('sim');

    expect(flow.currentStep()?.id).toBe('bedNumber');
    expect(flow.canSkip()).toBeTrue();
    expect(flow.messages().at(-1)?.text).toContain('leito');
  });

  it('an ambiguous answer repeats the question', async () => {
    await toAdmitQuestion();
    assistant.ask('talvez');

    expect(create).not.toHaveBeenCalled();
    expect(
      flow
        .messages()
        .slice(-2)
        .map(m => m.text),
    ).toEqual(['Responda sim ou não.', 'Deseja internar o paciente agora?']);
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
        { provide: Router, useValue: { navigate: (): Promise<boolean> => Promise.resolve(true) } },
        { provide: InternacaoCreationPort, useValue: { create: (): Promise<unknown> => Promise.resolve({}) } },
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
    assistant.ask('não');
    await settle();
  }

  it('422 goes back to the field question, server message first', async () => {
    await fill(new PatientFieldError('birthDate', 'MSG-02', 'Data inválida (servidor)'));

    expect(flow.currentStep()?.id).toBe('birthDate');
    expect(flow.messages().at(-2)?.text).toBe('Data inválida (servidor)');
    create.and.resolveTo({ id: 42 });
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
    create.and.resolveTo({ id: 42 });
    flow.retry();
    await settle();

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ fullName: 'Ana', sex: 'MALE' }));
    expect(flow.finished()).toBeTrue();
  });
});

describe('PatientRegistrationAction admission data (US-002-1-06)', () => {
  let create: jasmine.Spy<(request: CreatePatientRequest) => Promise<unknown>>;
  let createInternacao: jasmine.Spy<(id: number, request: CreateInternacaoRequest) => Promise<unknown>>;
  let flow: AssistantConversationService;
  let assistant: AiAssistantService;
  const texts = (): string[] => flow.messages().map(m => m.text);
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve));

  async function toAdmissionQuestions(): Promise<void> {
    spyOnProperty(navigator, 'language').and.returnValue('pt-BR');
    create = jasmine.createSpy('create').and.resolveTo({ id: 42 });
    createInternacao = jasmine.createSpy('createInternacao').and.resolveTo({});
    TestBed.configureTestingModule({
      providers: [
        { provide: PatientCreationPort, useValue: { create } },
        { provide: Router, useValue: { navigate: (): Promise<boolean> => Promise.resolve(true) } },
        { provide: InternacaoCreationPort, useValue: { create: createInternacao } },
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
    assistant.ask('sim');
  }

  const skipAll = (): void => {
    while (flow.canSkip() && !flow.finished()) {
      flow.skip();
    }
  };

  it('scenario 1: skipping every question creates the internação with all fields empty', async () => {
    await toAdmissionQuestions();
    skipAll();
    await settle();

    expect(createInternacao).toHaveBeenCalledOnceWith(42, {});
    expect(flow.finished()).toBeTrue();
  });

  it('"não sei" answers also leave the fields empty', async () => {
    await toAdmissionQuestions();
    for (const answer of ['não sei', 'não sei', 'não sei', 'não sei', 'não sei', 'não']) {
      assistant.ask(answer);
    }
    await settle();

    expect(createInternacao).toHaveBeenCalledOnceWith(42, {});
  });

  it('scenario 2: bed "302B" and the rest skipped creates the internação with only the bed', async () => {
    await toAdmissionQuestions();
    assistant.ask('302B');
    skipAll();
    await settle();

    expect(createInternacao).toHaveBeenCalledOnceWith(42, { bedNumber: '302B' });
  });

  it('collects every field and sends the dates as yyyy-mm-dd', async () => {
    await toAdmissionQuestions();
    assistant.ask('302B');
    assistant.ask('Unimed');
    assistant.ask('A-123');
    assistant.ask('20/11/2026');
    assistant.ask('21/11/2026');
    flow.skip();
    await settle();

    expect(createInternacao).toHaveBeenCalledOnceWith(42, {
      admissionNumber: 'A-123',
      bedNumber: '302B',
      healthInsurance: 'Unimed',
      hospitalAdmissionDate: '2026-11-20',
      nutritionalTherapyStartDate: '2026-11-21',
    });
  });

  it('answering "não" creates no internação', async () => {
    await toAdmissionQuestions();
    flow.reset();
    assistant.openAction(TestBed.inject(PatientRegistrationAction).build());
    for (const answer of ['Ana', '01/01/2000', 'masculino', '', 'não']) {
      assistant.ask(answer);
    }
    await settle();

    expect(create).toHaveBeenCalledOnceWith(jasmine.objectContaining({ fullName: 'Ana' }));
    expect(createInternacao).not.toHaveBeenCalled();
  });

  it('rejects answers over the limits and repeats the question', async () => {
    await toAdmissionQuestions();
    assistant.ask('1'.repeat(21));

    expect(texts().slice(-2)).toEqual([
      'O leito deve ter no máximo 20 caracteres.',
      'Qual o leito do paciente? (opcional)',
    ]);
    flow.skip();
    assistant.ask('a'.repeat(101));

    expect(texts().at(-2)).toBe('O convênio deve ter no máximo 100 caracteres.');
    flow.skip();
    assistant.ask('1'.repeat(31));

    expect(texts().at(-2)).toBe('O número de atendimento deve ter no máximo 30 caracteres.');
    expect(createInternacao).not.toHaveBeenCalled();
  });

  it('rejects an invalid nutritional therapy start date and repeats it', async () => {
    await toAdmissionQuestions();
    flow.skip();
    flow.skip();
    flow.skip();
    flow.skip();
    assistant.ask('31/02/2026');

    expect(texts().slice(-2)[0]).toBe('Informe uma data válida (dd/mm/aaaa).');
    expect(flow.currentStep()?.id).toBe('nutritionalTherapyStartDate');
  });

  it('scenario 3: a future admission date shows MSG-08 and asks the date again, nothing is created', async () => {
    await toAdmissionQuestions();
    flow.skip();
    flow.skip();
    flow.skip();
    assistant.ask('01/01/2999');

    expect(texts().slice(-2)).toEqual([
      'A data de internação hospitalar não pode ser uma data futura.',
      'Qual a data de internação hospitalar? (dd/mm/aaaa, opcional)',
    ]);

    expect(createInternacao).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('server 422 MSG-08 returns to the date question keeping the other answers and the created patient', async () => {
    await toAdmissionQuestions();
    createInternacao.and.rejectWith(new InternacaoFieldError('hospitalAdmissionDate', 'MSG-08', 'Texto do servidor'));
    assistant.ask('302B');
    flow.skip();
    flow.skip();
    assistant.ask('01/01/2020');
    flow.skip();
    flow.skip();
    await settle();

    expect(texts().slice(-2)).toEqual([
      'Texto do servidor',
      'Qual a data de internação hospitalar? (dd/mm/aaaa, opcional)',
    ]);
    createInternacao.and.resolveTo({});
    assistant.ask('02/01/2020');
    await settle();

    expect(create).toHaveBeenCalledTimes(1);
    expect(createInternacao).toHaveBeenCalledWith(42, { bedNumber: '302B', hospitalAdmissionDate: '2020-01-02' });
    expect(flow.finished()).toBeTrue();
  });

  it('server 422 MSG-08 without text falls back to the local MSG-08', async () => {
    await toAdmissionQuestions();
    createInternacao.and.rejectWith(new InternacaoFieldError('hospitalAdmissionDate', 'MSG-08'));
    skipAll();
    await settle();

    expect(texts().at(-2)).toBe('A data de internação hospitalar não pode ser uma data futura.');
  });

  it('a generic API failure shows the generic error and retry reuses the created patient', async () => {
    await toAdmissionQuestions();
    createInternacao.and.rejectWith(new Error('boom'));
    skipAll();
    await settle();

    expect(texts().at(-1)).toBe('Não foi possível cadastrar o paciente. Tente novamente.');
    expect(flow.canRetry()).toBeTrue();
    createInternacao.and.resolveTo({});
    flow.retry();
    await settle();

    expect(create).toHaveBeenCalledTimes(1);
    expect(createInternacao).toHaveBeenCalledTimes(2);
    expect(flow.finished()).toBeTrue();
  });
});

describe('PatientRegistrationAction locations (US-002-1-07)', () => {
  let createInternacao: jasmine.Spy<(id: number, request: CreateInternacaoRequest) => Promise<unknown>>;
  let flow: AssistantConversationService;
  const texts = (): string[] => flow.messages().map(m => m.text);
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve));
  const answers = (...list: string[]): void => list.forEach(a => flow.answer(a));

  beforeEach(async () => {
    spyOnProperty(navigator, 'language').and.returnValue('pt-BR');
    createInternacao = jasmine.createSpy('createInternacao').and.resolveTo({});
    TestBed.configureTestingModule({
      providers: [
        { provide: PatientCreationPort, useValue: { create: (): Promise<unknown> => Promise.resolve({ id: 42 }) } },
        { provide: Router, useValue: { navigate: (): Promise<boolean> => Promise.resolve(true) } },
        { provide: InternacaoCreationPort, useValue: { create: createInternacao } },
        {
          provide: LinkedHospitalsReader,
          useValue: { read: (): Promise<unknown> => Promise.resolve([{ id: 7, name: 'H' }]) },
        },
      ],
    });
    await TestBed.inject(HospitalContextService).load();
    flow = TestBed.inject(AssistantConversationService);
    const assistant = TestBed.inject(AiAssistantService);

    assistant.openAction(TestBed.inject(PatientRegistrationAction).build());
    answers('Ana', '01/01/2000', 'masculino', '', 'sim', '', '', '', '', '');
  });

  it('scenario 1: asks about Unidade/Ala after the admission data; "não" creates without locations', async () => {
    expect(texts().at(-1)).toBe('Deseja adicionar Unidade e/ou Ala à internação?');
    flow.answer('não');
    await settle();

    expect(createInternacao).toHaveBeenCalledOnceWith(42, {});
  });

  it('skipping the question also creates without locations', async () => {
    flow.skip();
    await settle();

    expect(createInternacao).toHaveBeenCalledOnceWith(42, {});
  });

  it('scenario 2: empty value shows MSG-10 and asks again', () => {
    answers('sim', 'unidade', '  ');

    expect(texts().slice(-2)).toEqual(['Preencha o valor da localização.', 'Qual o valor da localização?']);
  });

  it('unknown type shows MSG-09 and asks again; value above 100 chars is rejected', () => {
    answers('sim', 'sala');

    expect(texts().slice(-2)).toEqual([
      'Selecione o tipo: Unidade ou Ala.',
      'Qual o tipo da localização? (Unidade ou Ala)',
    ]);
    answers('ala', 'x'.repeat(101));

    expect(texts().at(-2)).toBe('O valor da localização deve ter no máximo 100 caracteres.');
  });

  it('sends one location', async () => {
    answers('sim', 'Unidade', 'UTI', 'não');
    flow.skip();
    await settle();

    expect(createInternacao).toHaveBeenCalledOnceWith(42, {
      locations: [{ locationType: 'UNIDADE', locationValue: 'UTI' }],
    });
  });

  it('rejects a repeated type for the second location', () => {
    answers('sim', 'unidade', 'UTI', 'sim', 'unidade');

    expect(texts().slice(-2)).toEqual([
      'Esse tipo já foi informado. Selecione o outro tipo.',
      'Qual o tipo da outra localização? (Unidade ou Ala)',
    ]);
  });

  it('scenario 3: asking for a third location reports the limit of 2 and adds nothing', async () => {
    answers('sim', 'unidade', 'UTI', 'sim', 'ala', 'Ala Norte', 'sim');

    expect(texts().at(-2)).toBe('O limite de 2 localizações foi atingido.');
    answers('não');
    flow.skip();
    await settle();

    expect(createInternacao).toHaveBeenCalledOnceWith(42, {
      locations: [
        { locationType: 'UNIDADE', locationValue: 'UTI' },
        { locationType: 'ALA', locationValue: 'Ala Norte' },
      ],
    });
  });

  it('scenario 4: a removed Ala is not sent', async () => {
    answers('sim', 'unidade', 'UTI', 'sim', 'ala', 'Ala Norte', 'não', 'Remover Ala');
    await settle();

    expect(createInternacao).toHaveBeenCalledOnceWith(42, {
      locations: [{ locationType: 'UNIDADE', locationValue: 'UTI' }],
    });
  });

  it('removing a location that was not informed or an unknown option is rejected', () => {
    answers('sim', 'unidade', 'UTI', 'não', 'remover ala');

    expect(texts().at(-2)).toBe('Essa localização não foi informada.');
    answers('xyz');

    expect(texts().at(-2)).toBe('Selecione o tipo: Unidade ou Ala.');
  });

  it('server 422 on locations shows the message and repeats the matching question', async () => {
    createInternacao.and.rejectWith(new InternacaoFieldError('locations', 'MSG-10', 'Texto do servidor'));
    answers('sim', 'unidade', 'UTI', 'não');
    flow.skip();
    await settle();

    expect(texts().slice(-2)).toEqual(['Texto do servidor', 'Qual o valor da localização?']);

    createInternacao.and.rejectWith(new InternacaoFieldError('locations', 'MSG-09'));
    flow.answer('UTI');
    await settle();

    expect(texts().slice(-2)).toEqual([
      'Selecione o tipo: Unidade ou Ala.',
      'Qual o tipo da localização? (Unidade ou Ala)',
    ]);
  });
});
