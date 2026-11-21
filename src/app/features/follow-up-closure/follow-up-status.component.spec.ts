import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import { FollowUpReopening, FollowUpReopeningRequest } from './follow-up-closure.models';
import { FollowUpClosureSource, FollowUpClosureWriter } from './follow-up-closure-source';
import { FollowUpStatusComponent } from './follow-up-status.component';
import { ProvisionalFollowUpClosureSource } from './provisional-follow-up-closure';

describe('FollowUpStatusComponent', () => {
  const NOW_DATE = new Date(2026, 10, 22, 9, 5);
  let fixture: ComponentFixture<FollowUpStatusComponent>;
  let store: ProvisionalFollowUpClosureSource;
  let online: WritableSignal<boolean>;
  let failReopen = false;
  let reopened: FollowUpReopening[];

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent.trim() === label);
  const close = (patientId: string, effectiveDate: string, at: string): Promise<unknown> =>
    store.close({ at, author: 'Ana', effectiveDate, patientId, reason: 'hospital-discharge' });
  const create = async (canReopen = true): Promise<void> => {
    fixture = TestBed.createComponent(FollowUpStatusComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.componentRef.setInput('canReopen', canReopen);
    fixture.componentInstance.reopened.subscribe(r => reopened.push(r));
    await settle();
  };

  beforeEach(() => {
    online = signal(true);
    failReopen = false;
    reopened = [];
    TestBed.configureTestingModule({
      providers: [
        ProvisionalFollowUpClosureSource,
        { provide: FollowUpClosureSource, useExisting: ProvisionalFollowUpClosureSource },
        {
          provide: FollowUpClosureWriter,
          useFactory: (): FollowUpClosureWriter => {
            const real = TestBed.inject(ProvisionalFollowUpClosureSource);

            return {
              close: (r): Promise<never> => real.close(r) as Promise<never>,
              reopen: (r: FollowUpReopeningRequest): Promise<FollowUpReopening> =>
                failReopen ? Promise.reject(new Error('falhou')) : real.reopen(r),
            };
          },
        },
        { provide: ConnectivityService, useValue: { online } },
        { provide: ProfessionalProfileReader, useValue: { read: (): object => ({ name: 'Michelle', role: 'other' }) } },
        { provide: NOW, useValue: (): Date => NOW_DATE },
      ],
    });
    store = TestBed.inject(ProvisionalFollowUpClosureSource);
  });

  it('paciente sem encerramentos não exibe a seção nem a ação', async () => {
    await create();

    expect(el().querySelector('.status')).toBeNull();
    expect(button('Reabrir acompanhamento')).toBeUndefined();
  });

  it('paciente encerrado mostra a ação de reabrir e o encerramento no histórico, com autor e data/hora', async () => {
    await close('p1', '2026-11-20', new Date(2026, 10, 21, 14, 30).toISOString());
    await create();

    expect(button('Reabrir acompanhamento')).toBeDefined();
    expect(el().textContent).toContain('Encerramento: Alta hospitalar · efeito em 20/11/2026');
    expect(el().textContent).toContain('Ana · 21/11/2026 14:30');
  });

  it('sem vínculo aprovado a ação não é oferecida, mas o histórico aparece', async () => {
    await close('p1', '2026-11-20', NOW_DATE.toISOString());
    await create(false);

    expect(button('Reabrir acompanhamento')).toBeUndefined();
    expect(el().textContent).toContain('Encerramento');
  });

  it('cancelar a confirmação não altera nada', async () => {
    await close('p1', '2026-11-20', NOW_DATE.toISOString());
    await create();
    button('Reabrir acompanhamento')?.click();
    await settle();

    expect(el().querySelector('app-confirm-dialog')?.getAttribute('aria-hidden')).toBe('false');
    button('Cancelar')?.click();
    await settle();

    expect(await store.listReopenings('p1')).toEqual([]);
    expect(button('Reabrir acompanhamento')).toBeDefined();
  });

  it('confirmar grava a reabertura com autor e data/hora, mantém o encerramento e sai do estado encerrado', async () => {
    await close('p1', '2026-11-20', new Date(2026, 10, 21, 14, 30).toISOString());
    await create();
    button('Reabrir acompanhamento')?.click();
    await settle();
    button('Reabrir')?.click();
    await settle();

    const [saved] = await store.listReopenings('p1');

    expect(saved.author).toBe('Michelle');
    expect(saved.at).toBe(NOW_DATE.toISOString());
    expect(saved.closureId).toBe((await store.list('p1'))[0].id);
    expect(reopened).toHaveSize(1);
    expect(await store.list('p1')).toHaveSize(1);
    expect(button('Reabrir acompanhamento')).toBeUndefined();
    expect(el().textContent).toContain('Revertido por reabertura em 22/11/2026 09:05');
    expect(el().textContent).toContain('Reabertura do acompanhamento');
    expect(el().textContent).toContain('Michelle · 22/11/2026 09:05');
  });

  it('com vários ciclos, mostra todos em ordem cronológica e dá para encerrar e reabrir de novo', async () => {
    await close('p1', '2026-11-10', new Date(2026, 10, 10, 8, 0).toISOString());
    const [first] = await store.list('p1');

    await store.reopen({
      at: new Date(2026, 10, 11, 8, 0).toISOString(),
      author: 'Bia',
      closureId: first.id,
      patientId: 'p1',
    });
    await close('p1', '2026-11-20', new Date(2026, 10, 20, 8, 0).toISOString());
    await create();

    const entries = Array.from(el().querySelectorAll('.status__what')).map(n => n.textContent.trim());

    expect(entries).toEqual([
      'Encerramento: Alta hospitalar · efeito em 10/11/2026',
      'Reabertura do acompanhamento',
      'Encerramento: Alta hospitalar · efeito em 20/11/2026',
    ]);

    expect(button('Reabrir acompanhamento')).toBeDefined();
  });

  it('sem conexão não abre a confirmação e avisa em texto', async () => {
    await close('p1', '2026-11-20', NOW_DATE.toISOString());
    await create();
    online.set(false);
    button('Reabrir acompanhamento')?.click();
    await settle();

    expect(el().querySelector('app-confirm-dialog')?.getAttribute('aria-hidden')).toBe('true');
    expect(el().textContent).toContain('Conexão necessária para reabrir o acompanhamento.');
    expect(await store.listReopenings('p1')).toEqual([]);
  });

  it('se a conexão cai com a confirmação aberta, não grava e avisa', async () => {
    await close('p1', '2026-11-20', NOW_DATE.toISOString());
    await create();
    button('Reabrir acompanhamento')?.click();
    await settle();
    online.set(false);
    button('Reabrir')?.click();
    await settle();

    expect(await store.listReopenings('p1')).toEqual([]);
    expect(el().textContent).toContain('Conexão necessária para reabrir');
  });

  it('falha na gravação avisa e não altera o estado', async () => {
    await close('p1', '2026-11-20', NOW_DATE.toISOString());
    await create();
    failReopen = true;
    button('Reabrir acompanhamento')?.click();
    await settle();
    button('Reabrir')?.click();
    await settle();

    expect(el().textContent).toContain('Não foi possível reabrir o acompanhamento');
    expect(button('Reabrir acompanhamento')).toBeDefined();
    expect(reopened).toEqual([]);
  });

  it('se a leitura falhar, a seção não aparece', async () => {
    spyOn(store, 'list').and.rejectWith(new Error('falhou'));
    await create();

    expect(el().querySelector('.status')).toBeNull();
  });
});
