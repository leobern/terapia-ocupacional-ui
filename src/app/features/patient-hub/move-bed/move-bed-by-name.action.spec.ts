import { TestBed } from '@angular/core/testing';

import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import { AssistantConversationService } from '../../../shared/services/assistant-conversation.service';
import { ScreenActionsService } from '../../../shared/services/screen-actions.service';
import {
  BedMovementPort,
  BedNotIdentifiedError,
  type PatientCandidate,
  PatientNotFoundError,
  PatientWithoutInternacaoError,
  type ResolvedBedMovement,
  type ResolvedByName,
} from './bed-movement.port';
import { BedNumberExtractor } from './bed-number-extractor';
import { MoveBedAction } from './move-bed.action';
import { PatientNameExtractor } from './patient-name-extractor';
import { ProvisionalBedNumberExtractor } from './provisional-bed-number-extractor';
import { ProvisionalPatientNameExtractor } from './provisional-patient-name-extractor';

const MSG_13 = 'Não encontrei nenhum paciente com esse nome neste hospital.';
const moved: ResolvedBedMovement = { currentBedNumber: '105', internacaoId: 9, newBedNumber: '210', pacienteId: 5 };
const candidates: PatientCandidate[] = [
  { birthDate: '1990-01-02', fullName: 'Beatriz Ramos Costa', id: 1, medicalRecordNumber: 'S1' },
  { birthDate: '1985-05-06', fullName: 'Beatriz Ramos Costa', id: 2, medicalRecordNumber: null },
];

describe('MoveBedAction.buildByName (US-002-2-02)', () => {
  let resolveByName: jasmine.Spy<(h: number, n: string, b?: string) => Promise<ResolvedByName>>;
  let resolve: jasmine.Spy<(id: number, bed?: string) => Promise<ResolvedBedMovement>>;
  let flow: AssistantConversationService;
  let assistant: AiAssistantService;
  const texts = (): string[] => flow.messages().map(m => m.text);
  const settle = (): Promise<void> => new Promise(done => setTimeout(done));

  function setup(hospitalId: number | null = 3): void {
    spyOnProperty(navigator, 'language').and.returnValue('pt-BR');
    resolveByName = jasmine.createSpy('resolveByName').and.resolveTo({ kind: 'single', resolved: moved });
    resolve = jasmine.createSpy('resolve').and.resolveTo(moved);
    TestBed.configureTestingModule({
      providers: [
        { provide: BedMovementPort, useValue: { confirm: jasmine.createSpy('confirm'), resolve, resolveByName } },
        { provide: BedNumberExtractor, useClass: ProvisionalBedNumberExtractor },
        { provide: PatientNameExtractor, useClass: ProvisionalPatientNameExtractor },
      ],
    });
    flow = TestBed.inject(AssistantConversationService);
    assistant = TestBed.inject(AiAssistantService);
    TestBed.inject(ScreenActionsService).register([
      TestBed.inject(MoveBedAction).buildByName(() => hospitalId ?? undefined),
    ]);
  }

  it('scenario 1: a single patient goes to the summary with the confirmation', async () => {
    setup();
    assistant.ask('mover Beatriz Ramos Costa para o leito 210');
    await settle();

    expect(resolveByName).toHaveBeenCalledOnceWith(3, 'Beatriz Ramos Costa', '210');
    expect(texts().slice(-2)).toEqual([
      'Resumo da alteração: paciente Beatriz Ramos Costa; campo: leito; valor atual: 105; valor novo: 210.',
      'Confirma a movimentação do leito?',
    ]);

    expect(flow.options().map(o => o.label)).toEqual(['Sim', 'Não']);
  });

  it('scenario 2: lists the candidates and, after the choice, resolves by the chosen id', async () => {
    setup();
    resolveByName.and.resolveTo({ candidates, kind: 'multiple' });
    assistant.ask('mover Beatriz Ramos Costa para o leito 210');
    await settle();

    expect(texts().at(-2)).toBe(
      [
        'Encontrei mais de um paciente com esse nome:',
        '1. Beatriz Ramos Costa — nascimento 02/01/1990 — SAME S1',
        '2. Beatriz Ramos Costa — nascimento 06/05/1985 — SAME não informado',
      ].join('\n'),
    );

    expect(texts().at(-1)).toBe('Qual desses pacientes?');

    flow.answer('9');

    expect(texts().slice(-2)).toEqual([
      'Escolha um dos pacientes listados, informando o número dele.',
      'Qual desses pacientes?',
    ]);

    expect(resolve).not.toHaveBeenCalled();

    flow.choose(flow.options()[1]);
    await settle();

    expect(resolve).toHaveBeenCalledOnceWith(2, '210');
    expect(texts().at(-1)).toBe('Confirma a movimentação do leito?');
  });

  it('choosing by number works and MSG-12 after the choice asks for the bed again', async () => {
    setup();
    resolveByName.and.resolveTo({ candidates, kind: 'multiple' });
    resolve.and.rejectWith(new BedNotIdentifiedError('newBedNumber', ''));
    assistant.ask('mover Beatriz Ramos Costa para o leito 210');
    await settle();
    flow.answer('1');
    await settle();

    expect(resolve).toHaveBeenCalledOnceWith(1, '210');
    expect(texts().at(-1)).toBe('Para qual leito deseja movimentar o paciente?');
  });

  it('a generic failure after the choice shows the generic error', async () => {
    setup();
    resolveByName.and.resolveTo({ candidates, kind: 'multiple' });
    resolve.and.rejectWith(new Error('x'));
    assistant.ask('mover Beatriz Ramos Costa para o leito 210');
    await settle();
    flow.answer('1');
    await settle();

    expect(texts().at(-1)).toBe('Não foi possível processar a movimentação de leito. Tente novamente.');
  });

  it('scenario 3: MSG-13 (server text, or the i18n one when empty) as an error', async () => {
    setup();
    resolveByName.and.rejectWith(new PatientNotFoundError(MSG_13));
    assistant.ask('mover Otávio Nunes Prado para o leito 210');
    await settle();

    expect(texts().at(-1)).toBe(MSG_13);
    expect(flow.messages().at(-1)?.tone).toBe('error');
    expect(flow.finished()).toBeTrue();
  });

  it('MSG-13 without a server message falls back to the i18n text', async () => {
    setup();
    resolveByName.and.rejectWith(new PatientNotFoundError());
    assistant.ask('mover Otávio Nunes Prado para o leito 210');
    await settle();

    expect(texts().at(-1)).toBe(MSG_13);
  });

  it('MSG-11 keeps the in-context handling', async () => {
    setup();
    resolveByName.and.rejectWith(new PatientWithoutInternacaoError(''));
    assistant.ask('mover Beatriz Ramos Costa para o leito 210');
    await settle();

    expect(texts().at(-1)).toContain('ainda não possui internação');
  });

  it('MSG-12 asks for the bed and retries the search with it', async () => {
    setup();
    resolveByName.and.rejectWith(new BedNotIdentifiedError('newBedNumber', ''));
    assistant.ask('mover Beatriz Ramos Costa para o leito');
    await settle();

    expect(resolveByName).toHaveBeenCalledOnceWith(3, 'Beatriz Ramos Costa', '');
    expect(texts().at(-1)).toBe('Para qual leito deseja movimentar o paciente?');

    resolveByName.and.resolveTo({ kind: 'single', resolved: moved });
    flow.answer('210');
    await settle();

    expect(resolveByName.calls.mostRecent().args).toEqual([3, 'Beatriz Ramos Costa', '210']);
    expect(texts().at(-1)).toBe('Confirma a movimentação do leito?');
  });

  it('without an identifiable name it does not call the API and asks for the name', async () => {
    setup();
    assistant.ask('mudar para o leito 210');
    await settle();

    expect(resolveByName).not.toHaveBeenCalled();
    expect(texts().slice(-2)).toEqual([
      'Não identifiquei o nome do paciente. Pode informá-lo?',
      'De qual paciente é a movimentação de leito? Informe o nome.',
    ]);

    flow.answer('Beatriz Ramos Costa');
    await settle();

    expect(resolveByName).toHaveBeenCalledOnceWith(3, 'Beatriz Ramos Costa', '');
  });

  it('a reply with digits and no name is rejected again', async () => {
    setup();
    assistant.ask('mudar para o leito 210');
    await settle();
    flow.answer('123');

    expect(resolveByName).not.toHaveBeenCalled();
    expect(texts().at(-2)).toBe('Não identifiquei o nome do paciente. Pode informá-lo?');
  });

  it('without an active hospital it fails generically and never calls the API', async () => {
    setup(null);
    assistant.ask('mover Beatriz Ramos Costa para o leito 210');
    await settle();

    expect(resolveByName).not.toHaveBeenCalled();
    expect(texts().at(-1)).toBe('Não foi possível processar a movimentação de leito. Tente novamente.');
  });
});
