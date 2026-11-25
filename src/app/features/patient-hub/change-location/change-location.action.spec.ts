import { TestBed } from '@angular/core/testing';

import { AiAssistantService } from '../../../shared/services/ai-assistant.service';
import { AssistantConversationService } from '../../../shared/services/assistant-conversation.service';
import { ScreenActionsService } from '../../../shared/services/screen-actions.service';
import {
  BedMovementPort,
  PatientNotFoundError,
  PatientWithoutInternacaoError,
  type ResolvedByName,
} from '../move-bed/bed-movement.port';
import { ChangeLocationAction } from './change-location.action';
import {
  LocationChangePort,
  LocationExtractor,
  LocationNotIdentifiedError,
  type LocationType,
  type ResolvedLocationChange,
} from './location-change.port';
import { ProvisionalLocationExtractor } from './provisional-location-extractor';

describe('ChangeLocationAction (US-002-2-06)', () => {
  let resolve: jasmine.Spy<(id: number, type: LocationType, value: string) => Promise<ResolvedLocationChange>>;
  let confirm: jasmine.Spy<(id: number, stay: number, type: LocationType, value: string) => Promise<void>>;
  let resolveByName: jasmine.Spy<(h: number, name: string, bed?: string) => Promise<ResolvedByName>>;
  let flow: AssistantConversationService;
  let assistant: AiAssistantService;
  const texts = (): string[] => flow.messages().map(m => m.text);
  const settle = (): Promise<void> => new Promise(done => setTimeout(done));
  const preview = (type: LocationType, value: string, current: string | null = null): ResolvedLocationChange => ({
    action: current === null ? 'CREATE' : 'UPDATE',
    currentValue: current,
    internacaoId: 9,
    locationType: type,
    newValue: value,
    pacienteId: 5,
  });

  beforeEach(() => {
    resolve = jasmine
      .createSpy('resolve')
      .and.callFake((_: number, type: LocationType, value: string) => Promise.resolve(preview(type, value)));
    confirm = jasmine.createSpy('confirm').and.resolveTo();
    resolveByName = jasmine.createSpy('resolveByName');
  });

  function setup(mode: 'context' | 'name' = 'context', patientId = '5', hospital: number | null = 1): void {
    spyOnProperty(navigator, 'language').and.returnValue('pt-BR');
    TestBed.configureTestingModule({
      providers: [
        { provide: LocationChangePort, useValue: { confirm, resolve } },
        { provide: BedMovementPort, useValue: { resolveByName } },
        { provide: LocationExtractor, useClass: ProvisionalLocationExtractor },
      ],
    });
    flow = TestBed.inject(AssistantConversationService);
    assistant = TestBed.inject(AiAssistantService);
    const action = TestBed.inject(ChangeLocationAction);

    TestBed.inject(ScreenActionsService).register([
      mode === 'context'
        ? action.build({ id: patientId, name: 'Helena Duarte Ramos' })
        : action.buildByName(() => hospital ?? undefined),
    ]);
  }

  it('scenario 1: "unidade UTI" asks to create the line', async () => {
    setup();
    assistant.ask('unidade UTI');
    await settle();

    expect(resolve).toHaveBeenCalledOnceWith(5, 'UNIDADE', 'UTI');
    expect(texts().slice(-2)).toEqual([
      'Resumo da alteração: paciente Helena Duarte Ramos; criar a linha "Unidade: UTI" na internação.',
      'Confirma a alteração da localização?',
    ]);
  });

  it('"Sim" confirms and informs success; "Não" cancels without calling confirm', async () => {
    setup();
    assistant.ask('unidade UTI');
    await settle();
    flow.answer('sim');
    await settle();

    expect(confirm).toHaveBeenCalledOnceWith(5, 9, 'UNIDADE', 'UTI');
    expect(texts().at(-1)).toBe('Linha criada: Unidade: UTI.');
  });

  it('"Não" does not call confirm', async () => {
    setup();
    assistant.ask('unidade UTI');
    await settle();
    flow.answer('não');
    await settle();

    expect(confirm).not.toHaveBeenCalled();
    expect(texts().at(-1)).toContain('Alteração cancelada');
  });

  it('invalid confirmation answer asks again', async () => {
    setup();
    assistant.ask('unidade UTI');
    await settle();
    flow.answer('talvez');
    await settle();

    expect(texts().at(-2)).toBe('Responda sim ou não.');
  });

  it('scenario 2: shows current and new value and updates', async () => {
    setup();
    resolve.and.resolveTo(preview('ALA', 'Ala Norte', 'Ala Sul'));
    assistant.ask('mudar a ala para Ala Norte');
    await settle();

    expect(texts().at(-2)).toBe(
      'Resumo da alteração: paciente Helena Duarte Ramos; atualizar a linha Ala de "Ala Sul" para "Ala Norte".',
    );
    flow.answer('sim');
    await settle();

    expect(confirm).toHaveBeenCalledOnceWith(5, 9, 'ALA', 'Ala Norte');
    expect(texts().at(-1)).toBe('Linha atualizada: Ala: Ala Norte.');
  });

  it('asks again when the value is missing, and accepts a free answer', async () => {
    setup();
    assistant.ask('mudar a ala');
    await settle();

    expect(texts().at(-1)).toContain('O que deseja alterar?');
    flow.answer('ala');
    await settle();

    expect(texts().at(-2)).toContain('Não identifiquei o valor');
    flow.answer('xyz');
    await settle();

    expect(texts().at(-2)).toContain('Não identifiquei se é unidade ou ala');
    flow.answer('ala Sul');
    await settle();

    expect(resolve).toHaveBeenCalledWith(5, 'ALA', 'Sul');
  });

  it('MSG-11 shows the server message or the fallback', async () => {
    setup();
    resolve.and.rejectWith(new PatientWithoutInternacaoError('sem internação'));
    assistant.ask('unidade UTI');
    await settle();

    expect(texts().at(-1)).toBe('sem internação');
  });

  it('MSG-11 fallback text', async () => {
    setup();
    resolve.and.rejectWith(new PatientWithoutInternacaoError());
    assistant.ask('unidade UTI');
    await settle();

    expect(texts().at(-1)).toContain('ainda não possui internação');
  });

  it('server MSG-10 returns to the request step, with fallback text when empty', async () => {
    setup();
    resolve.and.rejectWith(new LocationNotIdentifiedError('locationValue', 'MSG-10', 'valor?'));
    assistant.ask('unidade UTI');
    await settle();

    expect(texts().at(-2)).toBe('valor?');

    resolve.and.rejectWith(new LocationNotIdentifiedError('locationType', 'MSG-09'));
    flow.answer('unidade UTI');
    await settle();

    expect(texts().at(-2)).toContain('Não identifiquei se é unidade ou ala');
  });

  it('shows the generic error for other failures, including a non numeric patient id', async () => {
    setup();
    resolve.and.rejectWith(new Error('x'));
    assistant.ask('unidade UTI');
    await settle();

    expect(texts().at(-1)).toContain('Não foi possível processar a alteração');
  });

  it('non numeric patient id is a generic failure', async () => {
    setup('context', 'abc');
    assistant.ask('unidade UTI');
    await settle();

    expect(resolve).not.toHaveBeenCalled();
    expect(texts().at(-1)).toContain('Não foi possível processar a alteração');
  });

  it('confirm failure with MSG-10 goes back to the request step', async () => {
    setup();
    assistant.ask('unidade UTI');
    await settle();
    confirm.and.rejectWith(new LocationNotIdentifiedError('locationValue', 'MSG-10', 'valor?'));
    flow.answer('sim');
    await settle();

    expect(texts().at(-1)).toBe('valor?');
  });

  it('confirm failure with MSG-09 and no message uses the fallback text', async () => {
    setup();
    assistant.ask('unidade UTI');
    await settle();
    confirm.and.rejectWith(new LocationNotIdentifiedError('locationType', 'MSG-09'));
    flow.answer('sim');
    await settle();

    expect(texts().at(-1)).toContain('Não identifiquei se é unidade ou ala');
  });

  it('confirm failure with another error shows the generic message', async () => {
    setup();
    assistant.ask('unidade UTI');
    await settle();
    confirm.and.rejectWith(new Error('x'));
    flow.answer('sim');
    await settle();

    expect(texts().at(-1)).toContain('Não foi possível processar a alteração');
  });

  it('seeds nothing when the message has no unit or ward', () => {
    setup();
    const seed = TestBed.inject(ScreenActionsService).actions()[0].conversation?.seedFromMessage;

    expect(seed?.('olá')).toBe('');
  });

  describe('by name', () => {
    const single = (): ResolvedByName => ({
      kind: 'single',
      resolved: { currentBedNumber: null, internacaoId: 9, newBedNumber: '0', pacienteId: 5 },
    });

    it('asks the name, identifies the patient and confirms', async () => {
      setup('name');
      resolveByName.and.resolveTo(single());
      assistant.ask('unidade UTI');
      await settle();

      expect(texts().at(-1)).toBe('De qual paciente é a alteração? Informe o nome.');
      flow.answer('Helena Duarte Ramos');
      await settle();

      expect(resolveByName).toHaveBeenCalledWith(1, 'Helena Duarte Ramos', '0');
      expect(resolve).toHaveBeenCalledWith(5, 'UNIDADE', 'UTI');
      expect(texts().at(-2)).toContain('criar a linha "Unidade: UTI"');
    });

    it('MSG-13 when no patient is found, with server text or fallback', async () => {
      setup('name');
      resolveByName.and.rejectWith(new PatientNotFoundError());
      assistant.ask('unidade UTI');
      await settle();
      flow.answer('Fulano');
      await settle();

      expect(texts().at(-1)).toBe('Não encontrei nenhum paciente com esse nome neste hospital.');
    });

    it('MSG-13 uses the server message', async () => {
      setup('name');
      resolveByName.and.rejectWith(new PatientNotFoundError('nada'));
      assistant.ask('unidade UTI');
      await settle();
      flow.answer('Fulano');
      await settle();

      expect(texts().at(-1)).toBe('nada');
    });

    it('lists homonyms and continues with the chosen one', async () => {
      setup('name');
      resolveByName.and.resolveTo({
        candidates: [
          { birthDate: '1980-01-02', fullName: 'Ana Lima', id: 7, medicalRecordNumber: 'S1' },
          { birthDate: '1990-03-04', fullName: 'Ana Lima', id: 8, medicalRecordNumber: null },
        ],
        kind: 'multiple',
      });
      assistant.ask('unidade UTI');
      await settle();
      flow.answer('Ana Lima');
      await settle();

      expect(texts().at(-2)).toContain('1. Ana Lima — nascimento 02/01/1980 — SAME S1');
      expect(texts().at(-2)).toContain('SAME não informado');
      flow.answer('9');
      await settle();

      expect(texts().at(-2)).toBe('Escolha um dos pacientes listados, informando o número dele.');
      flow.answer('2');
      await settle();

      expect(resolve).toHaveBeenCalledWith(8, 'UNIDADE', 'UTI');
    });

    it('fails generically without an active hospital', async () => {
      setup('name', '5', null);
      assistant.ask('unidade UTI');
      await settle();
      flow.answer('Ana');
      await settle();

      expect(texts().at(-1)).toContain('Não foi possível processar a alteração');
    });

    it('rejects an empty name', async () => {
      setup('name');
      assistant.ask('unidade UTI');
      await settle();
      flow.answer('  ');
      await settle();

      expect(resolveByName).not.toHaveBeenCalled();
    });

    it('rethrows MSG-11 as a message', async () => {
      setup('name');
      resolveByName.and.rejectWith(new PatientWithoutInternacaoError());
      assistant.ask('unidade UTI');
      await settle();
      flow.answer('Ana');
      await settle();

      expect(texts().at(-1)).toContain('ainda não possui internação');
    });
  });
});
