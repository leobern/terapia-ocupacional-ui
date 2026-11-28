import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserPhotoService } from '../../shared/services/user-photo.service';
import { ApiSpy, createApiSpy } from './administration.testing';
import { AdministrationApi } from './administration-api';
import { ProfileEditPanelComponent } from './profile-edit-panel.component';

describe('ProfileEditPanelComponent', () => {
  let api: ApiSpy;
  let photos: jasmine.SpyObj<UserPhotoService>;
  let fixture: ComponentFixture<ProfileEditPanelComponent>;
  let el: HTMLElement;

  const profile = { hasPhoto: false, id: 7, name: 'Rafael Dutra', phone: null, registry: 'CRM 1', specialty: null };

  beforeEach(() => {
    api = createApiSpy();
    photos = jasmine.createSpyObj<UserPhotoService>('UserPhotoService', ['url', 'validate', 'upload', 'remove']);
    Object.defineProperty(photos, 'version', { get: () => (): number => 0 });
    photos.url.and.resolveTo(null);
    photos.validate.and.returnValue(null);
    photos.upload.and.resolveTo();
    photos.remove.and.resolveTo();
    TestBed.configureTestingModule({
      imports: [ProfileEditPanelComponent],
      providers: [
        { provide: AdministrationApi, useValue: api },
        { provide: UserPhotoService, useValue: photos },
      ],
    });
    fixture = TestBed.createComponent(ProfileEditPanelComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('profile', profile);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function type(selector: string, value: string): void {
    const input = el.querySelector(selector) as HTMLInputElement;

    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  const save = (): HTMLElement => el.querySelectorAll('.edit__footer app-button button')[0] as HTMLElement;

  function pick(file: File): void {
    const input = el.querySelector('[data-testid="photo-input"]') as HTMLInputElement;
    const transfer = new DataTransfer();

    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
  }

  it('aceita um perfil só com especialidade e telefone', () => {
    fixture.componentRef.setInput('profile', { ...profile, phone: '11', registry: null, specialty: 'X' });
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect((el.querySelector('#edit-registry') as HTMLInputElement).value).toBe('');
    expect((el.querySelector('#edit-phone') as HTMLInputElement).value).toBe('11');
  });

  it('abre preenchido com os dados atuais', () => {
    expect((el.querySelector('#edit-name') as HTMLInputElement).value).toBe('Rafael Dutra');
    expect((el.querySelector('#edit-registry') as HTMLInputElement).value).toBe('CRM 1');
  });

  it('salva os campos editados e avisa', async () => {
    const saved = jasmine.createSpy('saved');

    fixture.componentInstance.saved.subscribe(saved);
    type('#edit-name', 'Rafael D.');
    type('#edit-specialty', 'Nutrologia');
    type('#edit-registry', 'CRM 2');
    type('#edit-phone', '11 1');
    save().click();
    await settle();

    expect(api.saveProfile).toHaveBeenCalledWith({
      especialidade: 'Nutrologia',
      nomeCompleto: 'Rafael D.',
      registroProfissional: 'CRM 2',
      telefone: '11 1',
    });

    expect(saved).toHaveBeenCalledWith(undefined);
  });

  it('exige o nome e mostra erro se o salvamento falhar', async () => {
    type('#edit-name', '  ');
    save().click();
    await settle();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Informe o seu nome');
    expect(api.saveProfile).not.toHaveBeenCalled();

    type('#edit-name', 'Ok');
    api.saveProfile.and.rejectWith(new Error('x'));
    save().click();
    await settle();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível salvar');
  });

  it('envia a foto escolhida', async () => {
    pick(new File(['x'], 'a.png', { type: 'image/png' }));
    await settle();

    expect(photos.upload).toHaveBeenCalledWith(jasmine.any(File));
    expect(el.textContent).toContain('Trocar foto');
  });

  it('recusa foto inválida, avisa se o envio falhar e ignora seleção vazia', async () => {
    photos.validate.and.returnValue('A foto deve ter até 2 MB.');
    pick(new File(['x'], 'a.png', { type: 'image/png' }));
    await settle();

    expect(el.textContent).toContain('até 2 MB');
    expect(photos.upload).not.toHaveBeenCalled();

    photos.validate.and.returnValue(null);
    photos.upload.and.rejectWith(new Error('x'));
    pick(new File(['x'], 'a.png', { type: 'image/png' }));
    await settle();

    expect(el.textContent).toContain('Não foi possível enviar a foto');

    (el.querySelector('[data-testid="photo-input"]') as HTMLInputElement).dispatchEvent(new Event('change'));

    expect(photos.upload).toHaveBeenCalledTimes(1);
  });

  it('remove a foto e avisa se falhar', async () => {
    fixture.componentRef.setInput('profile', { ...profile, hasPhoto: true });
    fixture.detectChanges();
    (el.querySelector('.edit__remove') as HTMLElement).click();
    await settle();

    expect(photos.remove).toHaveBeenCalledWith();
    expect(el.querySelector('.edit__remove')).toBeNull();

    fixture.componentRef.setInput('profile', { ...profile, hasPhoto: true });
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    photos.remove.and.rejectWith(new Error('x'));
    (el.querySelector('.edit__remove') as HTMLElement).click();
    await settle();

    expect(el.textContent).toContain('Não foi possível remover a foto');
  });

  it('expõe o id do perfil e fecha pelo Cancelar', () => {
    const closed = jasmine.createSpy('closed');

    fixture.componentInstance.closed.subscribe(closed);
    (el.querySelectorAll('.edit__footer app-button button')[1] as HTMLElement).click();

    expect(closed).toHaveBeenCalledWith(undefined);
    expect(fixture.componentInstance.id()).toBe(7);
  });
});
