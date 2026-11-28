import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { ScreenActionsService } from '../../shared/services/screen-actions.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { UnreadNotificationsReader } from '../home/unread-notifications-reader';
import { FormulasApi } from './formulas-api';
import { PharmacyComponent } from './pharmacy.component';
import { ProvisionalFormulasApi } from './provisional-formulas-api';

class TwoHospitals extends LinkedHospitalsReader {
  read(): Promise<readonly { id: number; name: string }[]> {
    return Promise.resolve([
      { id: 1, name: 'Hospital A' },
      { id: 2, name: 'Hospital B' },
    ]);
  }
}

describe('PharmacyComponent', () => {
  let fixture: ComponentFixture<PharmacyComponent>;
  let api: ProvisionalFormulasApi;

  const text = (): string => fixture.nativeElement.textContent as string;
  const buttons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('.pharmacy__toggle'));
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    api = new ProvisionalFormulasApi();
    await TestBed.configureTestingModule({
      imports: [PharmacyComponent],
      providers: [
        { provide: LinkedHospitalsReader, useClass: TwoHospitals },
        { provide: FormulasApi, useValue: api },
        { provide: UnreadNotificationsReader, useValue: { countUnread: (): Promise<number> => Promise.resolve(3) } },
      ],
    }).compileComponents();
    await TestBed.inject(HospitalContextService).load();
    fixture = TestBed.createComponent(PharmacyComponent);
    fixture.detectChanges();
    await settle();
  });

  it('mostra o catálogo agrupado nas 6 categorias com os atributos', () => {
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.pharmacy__group-title')).map(el =>
      (el as HTMLElement).textContent?.trim(),
    );

    expect(titles).toEqual([
      'Enterais',
      'Parenterais',
      'Módulos proteicos',
      'Suplementos orais',
      'Espessantes',
      'Medicamentos',
    ]);
    for (const label of ['Fabricante', 'Tipo/apresentação', 'kcal/mL', 'Proteína (g/mL)', 'Via', 'Embalagem']) {
      expect(text()).toContain(label);
    }

    expect(text()).toContain('Proteína (g/g)');
    expect(text()).toContain('N/A');
    expect(text()).toContain('Sim');
    expect(text()).not.toContain('Vegetariano');
  });

  describe('padronizar por lista e pedidos', () => {
    const actions = (): ScreenActionsService => TestBed.inject(ScreenActionsService);
    const listInputs = (): {
      initialText: string;
      request: (description: string) => Promise<void>;
      standardize: (ids: readonly string[]) => Promise<readonly string[]>;
    } =>
      actions()
        .actions()
        .find(a => a.id === 'standardize-list')?.editor?.inputs as never;

    it('padroniza várias de uma vez e devolve o nome das que falharam', async () => {
      const save = api.setStandardized.bind(api);

      spyOn(api, 'setStandardized').and.callFake((hospital, id, value) =>
        id === 'enteral-2' ? Promise.reject(new Error('falhou')) : save(hospital, id, value),
      );

      const failed = await listInputs().standardize(['enteral-1', 'enteral-2']);

      await settle();

      expect(failed).toEqual(['Fórmula hipercalórica com fibras']);
      expect(fixture.nativeElement.querySelectorAll('.pharmacy__status--on').length).toBe(1);
    });

    it('o pedido enviado confirma na tela e entra na lista', async () => {
      expect(text()).not.toContain('Pedidos de inclusão');

      await listInputs().request('Peptamen');
      await settle();

      expect(text()).toContain('Pedido enviado. A equipe Conductia faz o cadastro da fórmula.');
      expect(text()).toContain('Pedidos de inclusão');
      expect(text()).toContain('Peptamen');
      expect(text()).toContain(`Enviado em ${new Date().toLocaleDateString('pt-BR')}`);
    });

    it('nomes escritos no assistente abrem a busca; áudio ainda não é entendido', async () => {
      const assistant = TestBed.inject(AiAssistantService);

      spyOn(assistant, 'openAction');
      const open = assistant.openAction as jasmine.Spy<AiAssistantService['openAction']>;
      const handler = actions().commandHandler();

      await handler?.({ kind: 'text', text: 'Diben' });

      expect(open.calls.mostRecent().args[0].id).toBe('standardize-list');
      expect(open.calls.mostRecent().args[0].editor?.inputs?.['initialText']).toBe('Diben');
      await expectAsync(handler?.({ audio: new Blob(), kind: 'audio' }) as Promise<void>).toBeRejected();
    });
  });

  it('padroniza e desmarca com estado em texto', async () => {
    buttons()[0].click();
    await settle();

    expect(text()).toContain('Desmarcar padronização');
    expect(fixture.nativeElement.querySelector('.pharmacy__status--on').textContent).toContain('Padronizada');

    buttons()[0].click();
    await settle();

    expect(fixture.nativeElement.querySelector('.pharmacy__status--on')).toBeNull();
  });

  it('provisório: o editor da prescrição só recebe as fórmulas padronizadas do hospital', async () => {
    expect(await api.listStandardizedForPatient('p1', 1)).toEqual([]);

    await api.setStandardized(1, 'enteral-1', true);

    expect((await api.listStandardizedForPatient('p1', 1)).map(f => f.id)).toEqual(['enteral-1']);
    expect(await api.listStandardizedForPatient('p1', 2)).toEqual([]);
  });

  it('a padronização do hospital A não afeta o B', async () => {
    await api.setStandardized(1, 'enteral-1', true);

    expect((await api.list(1)).find(f => f.id === 'enteral-1')?.standardized).toBe(true);
    expect((await api.list(2)).find(f => f.id === 'enteral-1')?.standardized).toBe(false);
  });

  it('offline: desabilita as ações, avisa em texto e mantém o catálogo', async () => {
    window.dispatchEvent(new Event('offline'));
    await settle();

    expect(text()).toContain('Sem conexão');
    expect(buttons().every(b => b.disabled)).toBe(true);
    expect(text()).toContain('Enterais');

    window.dispatchEvent(new Event('online'));
    await settle();

    expect(buttons().some(b => b.disabled)).toBe(false);
  });

  it('ignora o toggle offline', async () => {
    window.dispatchEvent(new Event('offline'));
    spyOn(api, 'setStandardized');
    const formula = (await api.list(1))[0];

    await (fixture.componentInstance as unknown as { toggle(f: unknown): Promise<void> }).toggle(formula);

    expect(api.setStandardized).not.toHaveBeenCalled();
  });

  it('falha ao salvar mostra erro e preserva o estado', async () => {
    spyOn(api, 'setStandardized').and.rejectWith(new Error('x'));
    buttons()[0].click();
    await settle();

    expect(text()).toContain('Não foi possível salvar');
    expect(buttons()[0].textContent).toContain('Padronizar');
  });

  it('erro de carga mostra texto e permite tentar de novo', async () => {
    spyOn(api, 'list').and.rejectWith(new Error('x'));
    await (fixture.componentInstance as unknown as { load(): Promise<void> }).load();
    fixture.detectChanges();

    expect(text()).toContain('Erro ao carregar');
    (api.list as jasmine.Spy).and.callThrough();

    (fixture.nativeElement.querySelector('.pharmacy__retry') as HTMLButtonElement).click();
    await settle();

    expect(text()).toContain('Enterais');
  });

  it('catálogo vazio mostra texto', async () => {
    spyOn(api, 'list').and.resolveTo([]);
    await (fixture.componentInstance as unknown as { load(): Promise<void> }).load();
    fixture.detectChanges();

    expect(text()).toContain('Nenhuma fórmula cadastrada');
  });

  describe('Solicitar fórmula (US-009-2-02)', () => {
    const action = (): { form?: { submit(values: Record<string, string>): Promise<void> | void } } | undefined =>
      TestBed.inject(ScreenActionsService)
        .actions()
        .find(a => a.id === 'request-formula') as never;

    it('oferece a ação nos atalhos com um formulário de descrição obrigatória', () => {
      const registered = TestBed.inject(ScreenActionsService)
        .actions()
        .find(a => a.id === 'request-formula');

      expect(registered?.label).toBe('Solicitar fórmula');
      expect(registered?.form?.fields.map(f => [f.id, f.required])).toEqual([['description', true]]);
    });

    it('registra o pedido para o hospital atual, sem aprovação automática', async () => {
      await action()?.form?.submit({ description: '  Fórmula hipercalórica Z  ' });

      expect(api.requests).toEqual([
        jasmine.objectContaining({ description: 'Fórmula hipercalórica Z', hospitalId: 1 }),
      ]);
    });

    it('rejeita descrição vazia e mantém o formulário aberto', async () => {
      await expectAsync(Promise.resolve(action()?.form?.submit({ description: '   ' }))).toBeRejected();

      expect(api.requests).toEqual([]);
    });

    it('rejeita quando a API falha, para o formulário manter as respostas', async () => {
      spyOn(api, 'requestFormula').and.rejectWith(new Error('x'));

      await expectAsync(Promise.resolve(action()?.form?.submit({ description: 'Z' }))).toBeRejected();
    });

    it('offline: a ação sai dos atalhos e o envio é recusado', async () => {
      const submit = action()?.form?.submit;

      window.dispatchEvent(new Event('offline'));
      await settle();

      expect(TestBed.inject(ScreenActionsService).actions().length).toBe(0);
      await expectAsync(Promise.resolve(submit?.({ description: 'Z' }))).toBeRejected();

      expect(api.requests).toEqual([]);

      window.dispatchEvent(new Event('online'));
      await settle();

      expect(TestBed.inject(ScreenActionsService).actions().length).toBe(2);
    });

    it('remove a ação ao sair da tela', () => {
      fixture.destroy();

      expect(TestBed.inject(ScreenActionsService).actions().length).toBe(0);
    });
  });

  it('mostra carregando enquanto busca', () => {
    spyOn(api, 'list').and.returnValue(new Promise(() => undefined));
    const other = TestBed.createComponent(PharmacyComponent);

    other.detectChanges();

    expect(other.nativeElement.textContent).toContain('Carregando');
  });

  it('primeira tela: tem o sino com a contagem de não lidas e ele leva às notificações', async () => {
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    const bell = fixture.nativeElement.querySelector('.page-header__bell button') as HTMLButtonElement;

    expect(bell.getAttribute('aria-label')).toBe('Notificações, 3 não lidas');

    bell.click();

    expect(navigate).toHaveBeenCalledWith(['/notifications']);
  });

  it('falha ao contar notificações não impede a tela: sino sem número', async () => {
    spyOn(TestBed.inject(UnreadNotificationsReader), 'countUnread').and.rejectWith(new Error('403'));
    const other = TestBed.createComponent(PharmacyComponent);

    other.detectChanges();
    await other.whenStable();
    other.detectChanges();

    expect(other.nativeElement.textContent).toContain('Enterais');
    expect(other.nativeElement.innerHTML).not.toContain('não lidas');
  });

  describe('sem hospital selecionado', () => {
    const render = async (read: () => Promise<readonly { id: number; name: string }[]>): Promise<string> => {
      const context = TestBed.inject(HospitalContextService);

      spyOn(TestBed.inject(LinkedHospitalsReader), 'read').and.callFake(read);
      // Sem os hospitais do beforeEach: com um já selecionado, a falha na releitura mantém a tela do catálogo.
      context.hospitals.set([]);
      await context.load();
      const other = TestBed.createComponent(PharmacyComponent);

      other.detectChanges();
      await other.whenStable();
      other.detectChanges();
      fixture = other;

      return other.nativeElement.textContent as string;
    };

    it('lista vazia: avisa em vez de carregar para sempre', async () => {
      expect(await render(() => Promise.resolve([]))).toContain('Nenhum hospital disponível');
    });

    it('erro ao ler hospitais: mostra o erro e permite tentar de novo', async () => {
      expect(await render(() => Promise.reject(new Error('403')))).toContain('Não foi possível carregar os hospitais');

      const context = TestBed.inject(HospitalContextService);
      const load = spyOn(context, 'load').and.resolveTo();

      (fixture.nativeElement.querySelector('.pharmacy__retry') as HTMLButtonElement).click();

      expect(load).toHaveBeenCalledWith();
    });

    it('enquanto os hospitais carregam, informa isso', () => {
      const context = TestBed.inject(HospitalContextService);

      spyOn(TestBed.inject(LinkedHospitalsReader), 'read').and.returnValue(new Promise(() => undefined));
      context.hospitals.set([]);
      void context.load();
      const other = TestBed.createComponent(PharmacyComponent);

      other.detectChanges();

      expect(other.nativeElement.textContent).toContain('Carregando os hospitais');
    });
  });
});
