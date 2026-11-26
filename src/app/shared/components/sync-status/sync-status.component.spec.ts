import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { LocalSessionStore } from '../../../features/auth/local-session-store';
import { NOW } from '../../../features/home/professional-profile';
import { NetworkStateService } from '../../offline/network-state.service';
import { OfflineStore, OutboxOperation } from '../../offline/offline-store';
import { InMemoryOfflineStore, tokenFor } from '../../offline/offline-testing.spec';
import { NewOutboxOperation, OutboxService } from '../../offline/outbox.service';
import { OUTBOX_SYNC_CONFIG, OutboxSyncService } from '../../offline/outbox-sync.service';
import { OutboxTransport, SendOutcome } from '../../offline/outbox-transport';
import { ViewportBreakpointService } from '../../services/viewport-breakpoint.service';
import { DrawerComponent } from '../drawer/drawer.component';
import { shortDateTime, SyncStatusComponent } from './sync-status.component';

class FakeTransport extends OutboxTransport {
  readonly sent: OutboxOperation[] = [];

  send(operation: OutboxOperation): Promise<SendOutcome> {
    this.sent.push(operation);

    return Promise.resolve({});
  }
}

const input = (extra: Partial<NewOutboxOperation> = {}): NewOutboxOperation => ({
  day: '2026-11-26',
  occurredAt: '2026-11-26T10:05:00',
  patientId: '42',
  payload: { text: 'oi' },
  type: 'evolution-text',
  ...extra,
});

let lockSequence = 0;

describe('SyncStatusComponent', () => {
  let fixture: ComponentFixture<SyncStatusComponent>;
  let outbox: OutboxService;
  let network: NetworkStateService;
  let transport: FakeTransport;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => document.body.textContent.replace(/\s+/gu, ' ');
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 5));
    fixture.detectChanges();
  };
  const chip = (): HTMLButtonElement | null => root().querySelector('[data-testid="sync-chip"]');
  const buttonByLabel = (label: string): HTMLElement =>
    Array.from(document.querySelectorAll<HTMLElement>('app-button')).find(b =>
      b.textContent.includes(label),
    ) as HTMLElement;

  const until = async (condition: () => boolean): Promise<void> => {
    for (let i = 0; i < 100 && !condition(); i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    fixture.detectChanges();
  };
  const dialogButton = (label: string): HTMLElement =>
    Array.from(document.querySelectorAll<HTMLElement>('app-confirm-dialog app-button'))
      .find(b => b.textContent.includes(label))
      ?.querySelector('button') as HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: OfflineStore, useFactory: (): InMemoryOfflineStore => new InMemoryOfflineStore() },
        { provide: OutboxTransport, useClass: FakeTransport },
        { provide: NOW, useValue: (): Date => new Date('2026-11-26T12:00:00.000Z') },
        {
          provide: OUTBOX_SYNC_CONFIG,
          useValue: {
            baseDelayMs: 1000,
            intervalMs: 60_000,
            lockName: `teste-status-${++lockSequence}`,
            maxDelayMs: 4000,
            maxServerErrors: 3,
          },
        },
        { provide: ViewportBreakpointService, useValue: { isDesktop: (): boolean => true } },
      ],
    });
    TestBed.inject(LocalSessionStore).open({ accessToken: tokenFor({ upn: 'ana@x.com' }), refreshToken: 'r' });
    outbox = TestBed.inject(OutboxService);
    network = TestBed.inject(NetworkStateService);
    transport = TestBed.inject(OutboxTransport) as FakeTransport;
    fixture = TestBed.createComponent(SyncStatusComponent);
    await settle();
  });

  afterEach(() => localStorage.clear());

  it('fica oculto quando tudo está no servidor e a rede responde', () => {
    expect(chip()).toBeNull();
  });

  it('mostra o contador de pendentes, de falhas e de conflitos', async () => {
    const a = await outbox.enqueue(input());
    const b = await outbox.enqueue(input());

    await outbox.enqueue(input());
    await outbox.update({ ...a, status: 'failed' });
    await outbox.update({ ...b, status: 'conflict' });
    await settle();

    expect(chip()?.textContent).toContain('1 pendente de sincronização · 1 com falha · 1 em conflito');
    expect(chip()?.classList).toContain('sync-chip--attention');
  });

  it('avisa "Sem conexão" e, com a tela em cópia local, a hora dela', async () => {
    network.markUnreachable();
    await settle();
    expect(chip()?.textContent).toContain('Sem conexão');
    expect(chip()?.textContent).not.toContain('dados de');

    network.markStale('2026-11-26T09:30:00');
    await settle();

    expect(chip()?.textContent).toContain(`Sem conexão · dados de ${shortDateTime('2026-11-26T09:30:00')}`);

    // Rede de volta, tela ainda na cópia local: não diz mais "sem conexão".
    network.markReachable();
    await settle();

    expect(chip()?.textContent).toContain(`Dados de ${shortDateTime('2026-11-26T09:30:00')} (cópia local)`);
    expect(chip()?.textContent).not.toContain('Sem conexão');
  });

  it('abre a lista com o estado de cada gravação e fecha', async () => {
    await outbox.enqueue(input());
    await settle();
    chip()?.click();
    await settle();

    expect(text()).toContain('Evolução médica · Paciente 42');
    expect(text()).toContain('Pendente de sincronização');
    chip()?.click();
    await settle();
  });

  it('"Enviar agora" esvazia a fila', async () => {
    await outbox.enqueue(input());
    await settle();
    chip()?.click();
    await settle();
    buttonByLabel('Enviar agora').querySelector('button')?.click();
    await until(() => outbox.totalCount() === 0);

    expect(transport.sent.length).toBe(1);
    expect(outbox.totalCount()).toBe(0);
  });

  it('falha: mostra o motivo, "Tentar de novo" reenvia e "Descartar" remove', async () => {
    const a = await outbox.enqueue(input());
    const b = await outbox.enqueue(
      input({ payload: { parameters: [{ parameterId: 'glycemia', value: 132 }] }, type: 'parameters' }),
    );

    await outbox.update({ ...a, attempted: true, reason: 'Texto em branco', status: 'failed' });
    await outbox.update({ ...b, attempted: true, reason: 'Outro', status: 'failed' });
    await settle();
    chip()?.click();
    await settle();

    expect(text()).toContain('Texto em branco');
    expect(text()).toContain('glycemia: 132');
    buttonByLabel('Descartar').querySelector('button')?.click();
    await settle();
    // Descartar apaga o que foi digitado: pede confirmação e só some se confirmado.
    expect(outbox.totalCount()).toBe(2);
    expect(document.body.textContent).toContain('Descartar esta gravação?');
    dialogButton('Continuar guardando').click();
    await settle();
    expect(outbox.totalCount()).toBe(2);
    buttonByLabel('Descartar').querySelector('button')?.click();
    await settle();
    dialogButton('Descartar').click();
    await settle();
    expect(outbox.totalCount()).toBe(1);
    buttonByLabel('Tentar de novo').querySelector('button')?.click();
    await until(() => outbox.totalCount() === 0);

    expect(transport.sent.length).toBe(1);
    expect(outbox.totalCount()).toBe(0);
  });

  it('conflito: mostra as duas versões e a escolhida é regravada como versão nova', async () => {
    const a = await outbox.enqueue(input({ baseVersion: 1 }));

    await outbox.update({
      ...a,
      attempted: true,
      conflict: {
        currentVersion: 4,
        mine: 'texto meu',
        others: [{ at: '2026-11-26T09:00:00', author: 'Bia', text: 'texto da Bia' }],
      },
      status: 'conflict',
    });
    await settle();
    chip()?.click();
    await settle();

    expect(text()).toContain('Sua versão');
    expect(text()).toContain('texto meu');
    expect(text()).toContain('Versão de Bia');
    buttonByLabel('Usar esta').querySelector('button')?.click();
    await until(() => outbox.totalCount() === 0);

    expect(transport.sent[0].payload['text']).toBe('texto da Bia');
    expect(transport.sent[0].baseVersion).toBe(4);
    expect(outbox.totalCount()).toBe(0);
  });

  it('"Manter a minha" regrava o próprio texto', async () => {
    const a = await outbox.enqueue(input());

    await outbox.update({
      ...a,
      attempted: true,
      conflict: { currentVersion: 4, mine: 'texto meu', others: [] },
      status: 'conflict',
    });
    await settle();
    chip()?.click();
    await settle();
    buttonByLabel('Manter a minha').querySelector('button')?.click();
    await until(() => transport.sent.length === 1);

    expect(transport.sent[0].payload['text']).toBe('texto meu');
  });

  it('fechar pela própria superfície (Esc, toque fora) recolhe a lista', async () => {
    await outbox.enqueue(input());
    await settle();
    chip()?.click();
    await settle();

    expect(chip()?.getAttribute('aria-expanded')).toBe('true');
    root().querySelector('app-drawer')?.dispatchEvent(new CustomEvent('closed'));
    (fixture.debugElement.query(By.directive(DrawerComponent)).componentInstance as DrawerComponent).closed.emit();
    await settle();

    expect(chip()?.getAttribute('aria-expanded')).toBe('false');
  });

  it('no celular usa o bottom sheet', async () => {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: OfflineStore, useFactory: (): InMemoryOfflineStore => new InMemoryOfflineStore() },
        { provide: OutboxTransport, useClass: FakeTransport },
        { provide: ViewportBreakpointService, useValue: { isDesktop: (): boolean => false } },
      ],
    });
    TestBed.inject(LocalSessionStore).open({ accessToken: tokenFor({ upn: 'ana@x.com' }), refreshToken: 'r' });
    fixture = TestBed.createComponent(SyncStatusComponent);
    TestBed.inject(NetworkStateService).markUnreachable();
    await settle();

    expect(root().querySelector('app-bottom-sheet')).not.toBeNull();
    expect(root().querySelector('app-drawer')).toBeNull();
  });

  it('com o OutboxSyncService injetado o sincronizador está disponível ao componente', () => {
    expect(TestBed.inject(OutboxSyncService)).toBeTruthy();
  });

  it('shortDateTime formata dd/mm às hh:mm', () => {
    expect(shortDateTime('2026-11-26T09:05:00')).toBe('26/11 às 09:05');
  });
});
