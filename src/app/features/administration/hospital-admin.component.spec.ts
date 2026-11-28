import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Role, SessionRoleReader } from '../../shared/auth/session-role';
import { ApiSpy, createApiSpy, HOSPITAL } from './administration.testing';
import { AdministrationApi } from './administration-api';
import { HospitalAdminComponent } from './hospital-admin.component';

describe('HospitalAdminComponent', () => {
  let api: ApiSpy;
  let fixture: ComponentFixture<HospitalAdminComponent>;
  let el: HTMLElement;

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function open(role: Role = Role.ADMIN): Promise<void> {
    api = createApiSpy();
    TestBed.configureTestingModule({
      imports: [HospitalAdminComponent],
      providers: [
        { provide: AdministrationApi, useValue: api },
        { provide: SessionRoleReader, useValue: { read: (): Role => role } },
      ],
    });
    fixture = TestBed.createComponent(HospitalAdminComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();
  }

  const items = (): HTMLElement[] => Array.from(el.querySelectorAll('.hospitals__item'));
  const link = (item: HTMLElement, label: string): HTMLElement =>
    Array.from(item.querySelectorAll('.hospitals__link')).find(l => l.textContent?.includes(label)) as HTMLElement;

  function type(selector: string, value: string): void {
    const input = el.querySelector(selector) as HTMLInputElement;

    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  const submit = (): HTMLElement => el.querySelector('.hospital-form__footer app-button button') as HTMLElement;

  it('lista os hospitais com pessoas, pacientes e gestor', async () => {
    await open();

    expect(items().length).toBe(2);
    expect(el.textContent).toContain('2 hospitais · 1 inativo');
    expect(items()[0].textContent).toContain('2 pessoas · 3 pacientes · Gestor: Paula Andrade');
    expect(items()[1].textContent).toContain('Sem endereço');
    expect(items()[1].textContent).toContain('Sem gestor');
  });

  it('subtítulo no plural para vários inativos e edita hospital sem endereço', async () => {
    await open();
    api.listHospitals.and.resolveTo([
      { ...HOSPITAL, ativo: false, endereco: null, id: 4 },
      { ...HOSPITAL, ativo: false, endereco: null, id: 5, nome: 'Outro' },
    ]);
    await fixture.componentInstance.load();
    await settle();

    expect(el.textContent).toContain('2 hospitais · 2 inativos');
    link(items()[0], 'Editar').click();
    fixture.detectChanges();

    expect((el.querySelector('#hospital-address') as HTMLInputElement).value).toBe('');
  });

  it('busca pelo nome', async () => {
    await open();
    type('.hospitals__search', 'b');
    fixture.detectChanges();

    expect(items().length).toBe(1);
  });

  it('só o ADMIN cadastra, edita e inativa', async () => {
    await open(Role.GESTOR);

    expect(el.querySelector('app-page-header app-button')).toBeNull();
    expect(el.querySelector('.hospitals__actions')).toBeNull();
  });

  it('cadastra um hospital', async () => {
    await open();
    (el.querySelector('app-page-header app-button button') as HTMLElement).click();
    fixture.detectChanges();
    type('#hospital-name', '  Hospital Novo ');
    type('#hospital-address', ' Rua 1 ');
    submit().click();
    await settle();

    expect(api.createHospital).toHaveBeenCalledWith('Hospital Novo', 'Rua 1');
    expect(api.listHospitals).toHaveBeenCalledTimes(2);
  });

  it('edita um hospital', async () => {
    await open();
    link(items()[0], 'Editar').click();
    fixture.detectChanges();

    expect((el.querySelector('#hospital-name') as HTMLInputElement).value).toBe('Hospital A');
    type('#hospital-name', 'Hospital A2');
    submit().click();
    await settle();

    expect(api.updateHospital).toHaveBeenCalledWith(1, 'Hospital A2', 'Rua das Palmeiras, 1200');
  });

  it('exige o nome e traduz o conflito de nome', async () => {
    await open();
    (el.querySelector('app-page-header app-button button') as HTMLElement).click();
    fixture.detectChanges();
    submit().click();
    await settle();

    expect(el.querySelector('.side-panel [role="alert"]')?.textContent).toContain('Informe o nome');

    type('#hospital-name', HOSPITAL.nome);
    api.createHospital.and.rejectWith({ status: 409 });
    submit().click();
    await settle();

    expect(el.querySelector('.side-panel [role="alert"]')?.textContent).toContain('Já existe um hospital');

    api.createHospital.and.rejectWith({ status: 500 });
    submit().click();
    await settle();

    expect(el.querySelector('.side-panel [role="alert"]')?.textContent).toContain('Não foi possível salvar');
  });

  it('inativa e reativa', async () => {
    await open();
    link(items()[0], 'Inativar').click();
    await settle();
    link(items()[1], 'Reativar').click();
    await settle();

    expect(api.setHospitalActive.calls.allArgs()).toEqual([
      [1, false],
      [2, true],
    ]);
  });

  it('avisa quando o hospital tem pacientes ou quando falha', async () => {
    await open();
    api.setHospitalActive.and.rejectWith({ status: 422 });
    link(items()[0], 'Inativar').click();
    await settle();

    expect(el.textContent).toContain('com pacientes não pode ser inativado');

    api.setHospitalActive.and.rejectWith({ status: 500 });
    link(items()[0], 'Inativar').click();
    await settle();

    expect(el.textContent).toContain('Não foi possível alterar o hospital');
  });

  it('mostra erro de carga e tenta de novo; subtítulo no singular', async () => {
    api = createApiSpy();
    api.listHospitals.and.rejectWith(new Error('x'));
    TestBed.configureTestingModule({
      imports: [HospitalAdminComponent],
      providers: [
        { provide: AdministrationApi, useValue: api },
        { provide: SessionRoleReader, useValue: { read: (): Role => Role.ADMIN } },
      ],
    });
    fixture = TestBed.createComponent(HospitalAdminComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();

    expect(el.textContent).toContain('Erro ao carregar os hospitais');

    api.listHospitals.and.resolveTo([HOSPITAL]);
    (el.querySelector('.hospitals__state .hospitals__link') as HTMLElement).click();
    await settle();

    expect(el.textContent).toContain('1 hospital');
    api.listHospitals.and.resolveTo([]);
    await fixture.componentInstance.load();
    await settle();

    expect(el.textContent).toContain('Nenhum hospital encontrado');
  });
});
