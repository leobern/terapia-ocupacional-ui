import { TestBed } from '@angular/core/testing';

import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import { AssistantConversationService } from '../../../shared/services/assistant-conversation.service';
import { ScreenActionsService } from '../../../shared/services/screen-actions.service';
import {
  BedMovementPort,
  BedNotIdentifiedError,
  PatientWithoutInternacaoError,
  type ResolvedBedMovement,
} from './bed-movement.port';
import { BedNumberExtractor } from './bed-number-extractor';
import { MoveBedAction } from './move-bed.action';
import { ProvisionalBedNumberExtractor } from './provisional-bed-number-extractor';

const MSG_11 =
  'Este paciente ainda não possui internação registrada. É necessário internar o paciente antes de movimentar o leito.';
const MSG_12 = 'Não consegui identificar o novo leito. Pode informar o número do leito?';

describe('MoveBedAction (US-002-2-01)', () => {
  let resolve: jasmine.Spy<(id: number, bed?: string) => Promise<ResolvedBedMovement>>;
  let flow: AssistantConversationService;
  let assistant: AiAssistantService;
  const texts = (): string[] => flow.messages().map(m => m.text);
  const settle = (): Promise<void> => new Promise(done => setTimeout(done));
  const moved = (bed: string, current: string | null = '302B'): ResolvedBedMovement => ({
    currentBedNumber: current,
    internacaoId: 9,
    newBedNumber: bed,
    pacienteId: 5,
  });

  beforeEach(() => {
    resolve = jasmine.createSpy('resolve').and.callFake((_: number, bed?: string) => Promise.resolve(moved(bed ?? '')));
  });

  function setup(patientId = '5'): void {
    spyOnProperty(navigator, 'language').and.returnValue('pt-BR');
    TestBed.configureTestingModule({
      providers: [
        { provide: BedMovementPort, useValue: { resolve } },
        { provide: BedNumberExtractor, useClass: ProvisionalBedNumberExtractor },
      ],
    });
    flow = TestBed.inject(AssistantConversationService);
    assistant = TestBed.inject(AiAssistantService);
    TestBed.inject(ScreenActionsService).register([
      TestBed.inject(MoveBedAction).build({ id: patientId, name: 'Marcos Vinícius Alves' }),
    ]);
  }

  it('scenario 1: "mudar para o leito 412" resolves the open patient with bed 412, without asking who', async () => {
    setup();
    assistant.ask('mudar para o leito 412');
    await settle();

    expect(assistant.view()).toBe('conversation');
    expect(resolve).toHaveBeenCalledOnceWith(5, '412');
    expect(texts().at(-1)).toBe(
      'Pedido associado à internação mais recente de Marcos Vinícius Alves. Leito atual: 302B. Novo leito: 412. A mudança ainda não foi aplicada.',
    );

    expect(flow.messages().at(-1)?.tone).toBe('success');
    expect(flow.finished()).toBeTrue();
  });

  it('shows a placeholder when the stay has no current bed', async () => {
    setup();
    resolve.and.resolveTo(moved('412', null));
    assistant.ask('trocar para o leito 412');
    await settle();

    expect(texts().at(-1)).toContain('Leito atual: não informado.');
  });

  it('scenario 2: MSG-11 blocks the request and finishes without retry', async () => {
    setup();
    resolve.and.rejectWith(new PatientWithoutInternacaoError(MSG_11));
    assistant.ask('mudar para o leito 412');
    await settle();

    expect(texts().at(-1)).toBe(MSG_11);
    expect(flow.messages().at(-1)?.tone).toBe('error');
    expect(flow.canRetry()).toBeFalse();
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('uses the local MSG-11 text when the server sends none', async () => {
    setup();
    resolve.and.rejectWith(new PatientWithoutInternacaoError());
    assistant.ask('mudar para o leito 412');
    await settle();

    expect(texts().at(-1)).toBe(MSG_11);
  });

  it('scenario 3: a message without bed shows MSG-12 and waits; answering resends the request (RN-03)', async () => {
    setup();
    resolve.and.callFake((_, bed) =>
      bed ? Promise.resolve(moved(bed)) : Promise.reject(new BedNotIdentifiedError('newBedNumber', MSG_12)),
    );
    assistant.ask('preciso mudar uma coisa aqui');
    await settle();

    expect(resolve).toHaveBeenCalledOnceWith(5, '');
    expect(texts().slice(-2)).toEqual([MSG_12, 'Para qual leito deseja movimentar o paciente?']);
    expect(flow.currentStep()?.id).toBe('newBedNumber');

    assistant.ask('412');
    await settle();

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve.calls.mostRecent().args).toEqual([5, '412']);
    expect(texts().at(-1)).toContain('Novo leito: 412');
  });

  it('uses the local MSG-12 text when the server sends none', async () => {
    setup();
    resolve.and.rejectWith(new BedNotIdentifiedError('newBedNumber'));
    assistant.ask('preciso mudar uma coisa aqui');
    await settle();

    expect(texts().at(-2)).toBe(MSG_12);
  });

  it('opened from the shortcuts it asks for the bed and sends the answer', async () => {
    setup();
    assistant.openAction(TestBed.inject(ScreenActionsService).actions()[0]);

    expect(texts()).toEqual(['Para qual leito deseja movimentar o paciente?']);
    assistant.ask('leito 412');
    await settle();

    expect(resolve).toHaveBeenCalledOnceWith(5, '412');
  });

  it('generic failures show the default error message and allow retry', async () => {
    setup();
    resolve.and.rejectWith(new Error('rede'));
    assistant.ask('mudar para o leito 412');
    await settle();

    expect(texts().at(-1)).toBe('Não foi possível processar a movimentação de leito. Tente novamente.');
    expect(flow.canRetry()).toBeTrue();
  });

  it('a non-numeric patient id is a generic failure and nothing is sent', async () => {
    setup('abc');
    assistant.ask('mudar para o leito 412');
    await settle();

    expect(resolve).not.toHaveBeenCalled();
    expect(flow.canRetry()).toBeTrue();
  });
});
