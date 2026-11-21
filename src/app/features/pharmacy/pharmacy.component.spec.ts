import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { FormulasApi } from './formulas-api';
import { PharmacyComponent } from './pharmacy.component';
import { ProvisionalFormulasApi } from './provisional-formulas-api';

class TwoHospitals extends LinkedHospitalsReader {
  read(): readonly { id: string; name: string }[] {
    return [
      { id: 'a', name: 'Hospital A' },
      { id: 'b', name: 'Hospital B' },
    ];
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
      ],
    }).compileComponents();
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
    await api.setStandardized('a', 'enteral-1', true);

    expect((await api.list('a')).find(f => f.id === 'enteral-1')?.standardized).toBe(true);
    expect((await api.list('b')).find(f => f.id === 'enteral-1')?.standardized).toBe(false);
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
    const formula = (await api.list('a'))[0];

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

  it('mostra carregando enquanto busca', () => {
    spyOn(api, 'list').and.returnValue(new Promise(() => undefined));
    const other = TestBed.createComponent(PharmacyComponent);

    other.detectChanges();

    expect(other.nativeElement.textContent).toContain('Carregando');
  });
});
