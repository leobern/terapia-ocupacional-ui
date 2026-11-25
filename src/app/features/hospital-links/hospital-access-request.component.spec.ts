import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../shared/services/connectivity.service';
import { HospitalAccessRequestComponent } from './hospital-access-request.component';
import { HospitalLink, HospitalLinkList, HospitalSearchPage } from './hospital-links.models';
import { HospitalLinksSource } from './hospital-links-source';

class FakePort extends HospitalLinksSource {
  links: HospitalLink[] = [];
  pages: HospitalSearchPage[] = [];
  searchError: unknown = null;
  listError: unknown = null;
  requestError: unknown = null;
  requested: number[] = [];
  cursors: (string | null)[] = [];

  async search(_: string, cursor: string | null): Promise<HospitalSearchPage> {
    this.cursors.push(cursor);
    if (this.searchError) {
      throw this.searchError;
    }

    return this.pages.shift() ?? { items: [], nextCursor: null };
  }

  async list(): Promise<HospitalLinkList> {
    if (this.listError) {
      throw this.listError;
    }

    return { hasApprovedLink: false, items: this.links };
  }

  async request(hospitalId: number): Promise<HospitalLink> {
    this.requested.push(hospitalId);
    if (this.requestError) {
      throw this.requestError;
    }

    return { hospitalId, hospitalName: `H${hospitalId}`, id: 100 + hospitalId, status: 'pending', updatedAt: 'x' };
  }
}

const http = (status: number): HttpErrorResponse => new HttpErrorResponse({ status });

describe('HospitalAccessRequestComponent', () => {
  let fixture: ComponentFixture<HospitalAccessRequestComponent>;
  let port: FakePort;
  let el: HTMLElement;
  const online = { online: (): boolean => true };

  const text = (): string => el.textContent ?? '';
  const flush = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const button = (label: string): HTMLElement | undefined =>
    Array.from(el.querySelectorAll<HTMLElement>('app-button')).find(b => b.textContent?.includes(label));
  const click = async (label: string): Promise<void> => {
    (button(label)?.querySelector('button') as HTMLButtonElement).click();
    await flush();
  };
  const type = async (value: string): Promise<void> => {
    const input = el.querySelector<HTMLInputElement>('#links-query') as HTMLInputElement;

    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const search = async (value = 'san'): Promise<void> => {
    await type(value);
    await click('Buscar');
  };
  const create = async (): Promise<void> => {
    fixture = TestBed.createComponent(HospitalAccessRequestComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await flush();
  };

  beforeEach(() => {
    port = new FakePort();
    TestBed.configureTestingModule({
      providers: [
        { provide: HospitalLinksSource, useValue: port },
        { provide: ConnectivityService, useValue: online },
      ],
    });
  });

  it('shows the empty state when there are no links', async () => {
    await create();

    expect(text()).toContain('Você ainda não tem vínculos');
  });

  it('shows an error when links cannot be loaded', async () => {
    port.listError = http(500);
    await create();

    expect(text()).toContain('Não foi possível carregar seus vínculos.');
  });

  it('Scenario 1: searches, confirms and lists the hospital as awaiting approval', async () => {
    port.pages = [{ items: [{ id: 1, name: 'Santa Casa' }], nextCursor: null }];
    await create();
    await search();
    await click('Selecionar');

    expect(text()).toContain('Enviar solicitação de acesso a Santa Casa');

    await click('Confirmar solicitação');

    expect(port.requested).toEqual([1]);
    expect(el.querySelector('[aria-label="Meus vínculos"]')?.textContent).toContain('Aguardando aprovação');
    expect(text()).toContain('Solicitação enviada ao gestor');
  });

  it('RN01: allows requesting several hospitals independently', async () => {
    port.pages = [
      {
        items: [
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
        ],
        nextCursor: null,
      },
    ];
    await create();
    await search();
    await click('Selecionar');
    await click('Confirmar solicitação');
    await click('Selecionar');
    await click('Confirmar solicitação');

    expect(port.requested).toEqual([1, 2]);
    expect(el.querySelectorAll('[aria-label="Meus vínculos"] li').length).toBe(2);
  });

  it('cancels the confirmation without requesting', async () => {
    port.pages = [{ items: [{ id: 1, name: 'A' }], nextCursor: null }];
    await create();
    await search();
    await click('Selecionar');
    await click('Cancelar');

    expect(port.requested).toEqual([]);
    expect(el.querySelector('[aria-label="Confirmar solicitação"]')).toBeNull();
  });

  it('does not search with fewer than 2 characters', async () => {
    await create();
    await search('s');

    expect(port.cursors).toEqual([]);
  });

  it('loads more results with the cursor', async () => {
    port.pages = [
      { items: [{ id: 1, name: 'A' }], nextCursor: 'c1' },
      { items: [{ id: 2, name: 'B' }], nextCursor: null },
    ];
    await create();
    await search();
    await click('Carregar mais');

    expect(port.cursors).toEqual([null, 'c1']);
    expect(el.querySelectorAll('[aria-label="Resultados da busca"] li').length).toBe(2);
    expect(button('Carregar mais')).toBeUndefined();
  });

  it('Scenario 3: shows "Hospital não encontrado" with guidance when nothing matches', async () => {
    await create();
    await search('zzz');

    expect(text()).toContain('Hospital não encontrado');
    expect(text()).toContain('entre em contato com o suporte');
  });

  it('Scenario 2: flags pending and approved hospitals and blocks a new request', async () => {
    port.links = [
      { hospitalId: 1, hospitalName: 'A', id: 1, status: 'pending', updatedAt: 'x' },
      { hospitalId: 2, hospitalName: 'B', id: 2, status: 'approved', updatedAt: 'x' },
      { hospitalId: 3, hospitalName: 'C', id: 3, status: 'refused', updatedAt: 'x' },
    ];
    port.pages = [
      {
        items: [
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
          { id: 3, name: 'C' },
        ],
        nextCursor: null,
      },
    ];
    await create();
    await search();

    const rows = el.querySelectorAll('[aria-label="Resultados da busca"] li');

    expect(rows[0].textContent).toContain('Aguardando aprovação');
    expect(rows[1].textContent).toContain('Aprovado');
    expect(rows[2].querySelector('app-button')).not.toBeNull();
    expect(rows[0].querySelector('app-button')).toBeNull();
  });

  it('Scenario 2: explains the conflict on 409 and refreshes the links', async () => {
    port.pages = [{ items: [{ id: 1, name: 'A' }], nextCursor: null }];
    await create();
    await search();
    await click('Selecionar');
    port.requestError = http(409);
    port.links = [{ hospitalId: 1, hospitalName: 'A', id: 1, status: 'pending', updatedAt: 'x' }];
    await click('Confirmar solicitação');

    expect(text()).toContain('Já existe uma solicitação pendente');
    expect(el.querySelectorAll('[aria-label="Meus vínculos"] li').length).toBe(1);
  });

  it('select() refuses a blocked hospital with an explanation', async () => {
    port.links = [{ hospitalId: 1, hospitalName: 'A', id: 1, status: 'approved', updatedAt: 'x' }];
    await create();
    (fixture.componentInstance as unknown as { select(h: { id: number; name: string }): void }).select({
      id: 1,
      name: 'A',
    });
    fixture.detectChanges();

    expect(text()).toContain('Já existe uma solicitação pendente ou vínculo aprovado');
  });

  for (const [status, expected] of [
    [404, 'Hospital não encontrado'],
    [400, 'Dados inválidos'],
    [401, 'sessão expirou'],
    [403, 'Apenas profissionais'],
    [0, 'Não foi possível enviar a solicitação'],
  ] as const) {
    it(`maps request error ${status} to a text message`, async () => {
      port.pages = [{ items: [{ id: 1, name: 'A' }], nextCursor: null }];
      await create();
      await search();
      await click('Selecionar');
      port.requestError = status === 0 ? new Error('rede') : http(status);
      await click('Confirmar solicitação');

      expect(text()).toContain(expected);
    });
  }

  it('shows a text message when the search fails', async () => {
    port.searchError = http(500);
    await create();
    await search();

    expect(text()).toContain('Não foi possível buscar hospitais');
  });

  it('shows an offline notice and blocks searching', async () => {
    TestBed.overrideProvider(ConnectivityService, { useValue: { online: (): boolean => false } });
    await create();
    await type('san');

    expect(text()).toContain('Sem conexão');
    expect(port.cursors).toEqual([]);
  });

  it('goes back', async () => {
    await create();
    spyOn(TestBed.inject(Location), 'back');

    (fixture.componentInstance as unknown as { back(): void }).back();

    expect(TestBed.inject(Location).back).toHaveBeenCalledWith();
  });
});
