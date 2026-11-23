import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { DirectedMessageSource, PatientTeamSource, ReevaluationSource, ReevaluationWriter } from './observation-source';
import { ProvisionalObservationStore, ProvisionalPatientTeamSource } from './provisional-observation';
import { ReevaluationListComponent } from './reevaluation-list.component';

describe('ReevaluationListComponent', () => {
  let fixture: ComponentFixture<ReevaluationListComponent>;
  let store: ProvisionalObservationStore;
  let online: WritableSignal<boolean>;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent.trim() === label);
  const click = async (label: string): Promise<void> => {
    button(label)?.click();
    await settle();
  };
  const create = (dueDate: string): Promise<unknown> =>
    store.create({
      author: 'Ana',
      createdAt: 't',
      dueDate,
      observationId: 'o',
      patientId: 'p1',
      reason: `Reavaliar ${dueDate}`,
      recipients: { group: 'medicos', people: [] },
    });

  beforeEach(async () => {
    store = new ProvisionalObservationStore();
    online = signal(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: ReevaluationSource, useValue: store },
        { provide: ReevaluationWriter, useValue: store },
        { provide: DirectedMessageSource, useValue: store },
        { provide: PatientTeamSource, useClass: ProvisionalPatientTeamSource },
        { provide: ConnectivityService, useValue: { online } },
        { provide: ProfessionalProfileReader, useValue: { read: (): object => ({ name: 'Rafael', role: 'doctor' }) } },
        { provide: NOW, useValue: (): Date => new Date(2026, 10, 23, 9) },
      ],
    });
    fixture = TestBed.createComponent(ReevaluationListComponent);
    fixture.componentRef.setInput('patientId', 'p1');
  });

  it('sem registros não mostra nada', async () => {
    await settle();

    expect(el().textContent?.trim()).toBe('');
  });

  it('mostra "Vencida" (com texto) só para prazo passado e não resolvido', async () => {
    await create('2026-11-22');
    await create('2026-11-23');
    await create('2026-11-24');
    await settle();
    await settle();

    const badges = Array.from(el().querySelectorAll('.reev__badge')).map(b => b.textContent.trim());

    expect(badges).toEqual(['Vencida']);
    expect(el().querySelectorAll('article').length).toBe(3);
  });

  it('qualquer participante resolve direto na lista; deixa de aparecer como vencida e registra autor e hora', async () => {
    await create('2026-11-22');
    await settle();
    await settle();
    await click('Marcar como resolvida');

    const [item] = await store.list('p1');

    expect(item.resolvedBy).toBe('Rafael');
    expect(item.resolvedAt).toContain('2026-11-23');
    expect(el().textContent).not.toContain('Vencida');
    expect(el().textContent).toContain('Resolvida por Rafael');
    expect(button('Marcar como resolvida')).toBeUndefined();
  });

  it('altera destinatários depois de criada e registra a mudança; grupo vazio é rejeitado', async () => {
    await create('2026-11-24');
    await settle();
    await settle();
    await click('Alterar destinatários');
    const select = el().querySelector<HTMLSelectElement>('select') as HTMLSelectElement;

    select.value = 'fisio';
    select.dispatchEvent(new Event('change'));
    await settle();

    expect(el().textContent).toContain('Não há destinatário válido');
    expect(button('Salvar destinatários')?.disabled).toBeTrue();
    await click('Salvar destinatários');

    expect((await store.list('p1'))[0].changes).toEqual([]);

    select.value = 'nutris';
    select.dispatchEvent(new Event('change'));
    await settle();
    await click('Salvar destinatários');

    const [item] = await store.list('p1');

    expect(item.recipients.group).toBe('nutris');
    expect(item.changes[0].author).toBe('Rafael');
    expect(el().textContent).toContain('@nutris');
  });

  it('cancelar a edição não altera nada', async () => {
    await create('2026-11-24');
    await settle();
    await settle();
    await click('Alterar destinatários');
    await click('Cancelar');

    expect(button('Alterar destinatários')).toBeDefined();
  });

  it('offline desabilita resolver e alterar', async () => {
    await create('2026-11-24');
    online.set(false);
    await settle();
    await settle();

    expect(button('Marcar como resolvida')?.disabled).toBeTrue();
    expect(button('Alterar destinatários')?.disabled).toBeTrue();
    expect(el().textContent).toContain('Sem conexão');
  });

  it('falha ao gravar mostra o aviso', async () => {
    await create('2026-11-24');
    await settle();
    await settle();
    spyOn(store, 'resolve').and.rejectWith(new Error('x'));
    await click('Marcar como resolvida');

    expect(el().querySelector('[role=alert]')?.textContent).toContain('Não foi possível salvar');
  });

  it('lista as mensagens enviadas e recarrega quando a versão muda', async () => {
    await settle();
    await store.send({
      at: 't',
      author: 'Ana',
      observationId: 'o',
      patientId: 'p1',
      recipients: { group: 'enfermagem', people: [] },
      text: 'Reforçar cuidados',
    });
    fixture.componentRef.setInput('version', 1);
    await settle();
    await settle();

    expect(el().textContent).toContain('Reforçar cuidados');
    expect(el().textContent).toContain('@enfermagem');
  });

  it('mantém o exibido se a leitura falhar', async () => {
    spyOn(store, 'list').and.rejectWith(new Error('x'));
    await settle();

    expect(el().textContent?.trim()).toBe('');
  });
});
