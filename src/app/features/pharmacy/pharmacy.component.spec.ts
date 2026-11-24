import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

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

  it('mostra o catálogo agrupado nas 4 categorias com os atributos', () => {
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.pharmacy__group-title')).map(el =>
      (el as HTMLElement).textContent?.trim(),
    );

    expect(titles).toEqual(['Enterais', 'Parenterais', 'Suplementos orais', 'Medicamentos']);
    for (const label of ['kcal/ml', 'Proteína/ml', 'Fibra', 'Sacarose', 'Lactose', 'Glúten', 'Vegetariano/vegano']) {
      expect(text()).toContain(label);
    }

    expect(text()).toContain('Vegano');
    expect(text()).toContain('Vegetariano');
    expect(text()).toContain('Não se aplica');
    expect(text()).toContain('—');
    expect(text()).toContain('Sim');
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

      expect(api.requests).toEqual([{ description: 'Fórmula hipercalórica Z', hospitalId: 1 }]);
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

      expect(TestBed.inject(ScreenActionsService).actions().length).toBe(1);
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
});
