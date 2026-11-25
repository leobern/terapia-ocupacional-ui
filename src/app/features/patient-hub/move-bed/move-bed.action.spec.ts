import { TestBed } from '@angular/core/testing';

import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import { AssistantConversationService } from '../../../shared/services/assistant-conversation.service';
import { ScreenActionsService } from '../../../shared/services/screen-actions.service';
import {
  BedMovementPort,
  BedNotIdentifiedError,
  type BedOccupancy,
  BedOccupancyPort,
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
  let confirm: jasmine.Spy<(id: number, stay: number, bed: string) => Promise<void>>;
  let check: jasmine.Spy<(id: number, bed: string) => Promise<BedOccupancy>>;
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
    check = jasmine
      .createSpy('check')
      .and.callFake((_: number, bed: string) => Promise.resolve({ newBedNumber: bed, occupants: [], occupied: false }));
    resolve = jasmine.createSpy('resolve').and.callFake((_: number, bed?: string) => Promise.resolve(moved(bed ?? '')));
    confirm = jasmine.createSpy('confirm').and.resolveTo();
  });

  function setup(patientId = '5'): void {
    spyOnProperty(navigator, 'language').and.returnValue('pt-BR');
    TestBed.configureTestingModule({
      providers: [
        { provide: BedMovementPort, useValue: { confirm, resolve } },
        { provide: BedOccupancyPort, useValue: { check } },
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
    expect(texts().slice(-2)).toEqual([
      'Resumo da alteração: paciente Marcos Vinícius Alves; campo: leito; valor atual: 302B; valor novo: 412.',
      'Confirma a movimentação do leito?',
    ]);

    expect(flow.options().map(o => o.label)).toEqual(['Sim', 'Não']);
    expect(flow.finished()).toBeFalse();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('scenario 2: "Sim" applies the new bed to the stay and reports it', async () => {
    setup();
    assistant.ask('mudar para o leito 412');
    await settle();
    flow.choose(flow.options()[0]);
    await settle();

    expect(confirm).toHaveBeenCalledOnceWith(5, 9, '412');
    expect(texts().at(-1)).toBe('Leito atualizado para 412.');
    expect(flow.messages().at(-1)?.tone).toBe('success');
    expect(flow.finished()).toBeTrue();
  });

  it('scenario 3: "Não" cancels without writing and keeps the current bed', async () => {
    setup();
    assistant.ask('mudar para o leito 412');
    await settle();
    flow.answer('não');
    await settle();

    expect(confirm).not.toHaveBeenCalled();
    expect(texts().at(-1)).toBe('Movimentação cancelada. O leito permanece 302B.');
    expect(flow.finished()).toBeTrue();
  });

  it('cancelling with no current bed uses the placeholder', async () => {
    setup();
    resolve.and.resolveTo(moved('412', null));
    assistant.ask('mudar para o leito 412');
    await settle();
    flow.answer('no');
    await settle();

    expect(texts().at(-1)).toBe('Movimentação cancelada. O leito permanece não informado.');
  });

  it('an invalid confirmation answer asks again without writing', async () => {
    setup();
    assistant.ask('mudar para o leito 412');
    await settle();
    flow.answer('talvez');

    expect(texts().slice(-2)).toEqual(['Responda sim ou não.', 'Confirma a movimentação do leito?']);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('"Sim" with a MSG-12 from the server asks for the bed again and confirms the new one', async () => {
    setup();
    confirm.and.rejectWith(new BedNotIdentifiedError('newBedNumber', MSG_12));
    assistant.ask('mudar para o leito 412');
    await settle();
    flow.answer('sim');
    await settle();

    expect(texts().slice(-2)).toEqual([MSG_12, 'Para qual leito deseja movimentar o paciente?']);
    expect(flow.finished()).toBeFalse();

    confirm.and.resolveTo();
    flow.answer('leito 500');
    await settle();

    expect(resolve.calls.mostRecent().args).toEqual([5, '500']);
    expect(texts().at(-1)).toBe('Confirma a movimentação do leito?');
  });

  it('re-asking the bed after MSG-12 on confirm sends an empty bed when none is recognised', async () => {
    setup();
    confirm.and.rejectWith(new BedNotIdentifiedError('newBedNumber', MSG_12));
    assistant.ask('mudar para o leito 412');
    await settle();
    flow.answer('sim');
    await settle();
    flow.answer('nenhum');
    await settle();

    expect(resolve.calls.mostRecent().args).toEqual([5, '']);
  });

  it('MSG-12 on confirm without server text uses the local message', async () => {
    setup();
    confirm.and.rejectWith(new BedNotIdentifiedError('newBedNumber'));
    assistant.ask('mudar para o leito 412');
    await settle();
    flow.answer('sim');
    await settle();

    expect(texts().at(-2)).toBe(MSG_12);
  });

  it('a generic failure on confirm shows the error without reporting success', async () => {
    setup();
    confirm.and.rejectWith(new Error('403'));
    assistant.ask('mudar para o leito 412');
    await settle();
    flow.answer('sim');
    await settle();

    expect(texts().at(-1)).toBe('Não foi possível processar a movimentação de leito. Tente novamente.');
    expect(flow.messages().at(-1)?.tone).toBe('error');
    expect(flow.finished()).toBeFalse();
  });

  it('shows a placeholder when the stay has no current bed', async () => {
    setup();
    resolve.and.resolveTo(moved('412', null));
    assistant.ask('trocar para o leito 412');
    await settle();

    expect(texts().at(-2)).toContain('valor atual: não informado');
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
    expect(texts().at(-2)).toContain('valor novo: 412');
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

  it('US-002-2-04 scenario 1: occupied bed adds an alert with the occupant name, without blocking', async () => {
    setup();
    check.and.resolveTo({
      newBedNumber: '412',
      occupants: [{ name: 'Helena Duarte Ramos', pacienteId: 7 }],
      occupied: true,
    });
    assistant.ask('mudar para o leito 412');
    await settle();

    expect(check).toHaveBeenCalledOnceWith(5, '412');
    expect(texts().at(-2)).toContain('valor novo: 412.');
    expect(texts().at(-2)).toContain('Atenção: o leito 412 já está ocupado por Helena Duarte Ramos.');
    expect(texts().at(-1)).toBe('Confirma a movimentação do leito?');
    expect(flow.options().map(o => o.label)).toEqual(['Sim', 'Não']);
  });

  it('US-002-2-04: lists every occupant in the alert', async () => {
    setup();
    check.and.resolveTo({
      newBedNumber: '412',
      occupants: [
        { name: 'Helena Duarte Ramos', pacienteId: 7 },
        { name: 'Paulo Lima', pacienteId: 8 },
      ],
      occupied: true,
    });
    assistant.ask('mudar para o leito 412');
    await settle();

    expect(texts().at(-2)).toContain('ocupado por Helena Duarte Ramos, Paulo Lima.');
  });

  it('US-002-2-04: occupied flag without occupants shows no alert', async () => {
    setup();
    check.and.resolveTo({ newBedNumber: '412', occupants: [], occupied: true });
    assistant.ask('mudar para o leito 412');
    await settle();

    expect(texts().at(-2)).not.toContain('Atenção');
  });

  it('US-002-2-04 scenario 2: free bed shows the confirmation without any alert', async () => {
    setup();
    assistant.ask('mudar para o leito 415');
    await settle();

    expect(check).toHaveBeenCalledOnceWith(5, '415');
    expect(texts().at(-2)).not.toContain('Atenção');
  });

  it('US-002-2-04: a failing occupancy check shows the default error message', async () => {
    setup();
    check.and.rejectWith(new Error('rede'));
    assistant.ask('mudar para o leito 412');
    await settle();

    expect(texts().at(-1)).toBe('Não foi possível processar a movimentação de leito. Tente novamente.');
  });

  it('US-002-2-04: MSG-11 from the occupancy check keeps the usual message', async () => {
    setup();
    check.and.rejectWith(new PatientWithoutInternacaoError());
    assistant.ask('mudar para o leito 412');
    await settle();

    expect(texts().at(-1)).toBe(MSG_11);
  });
});
