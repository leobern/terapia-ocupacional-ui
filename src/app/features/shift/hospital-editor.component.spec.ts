import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { AssistantEditorController } from '../../shared/services/assistant-editor-controller.service';
import { GeolocationError, GeolocationService, GeoPoint } from '../../shared/services/geolocation.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { LinkedHospital } from '../home/linked-hospitals';
import { NOW } from '../home/professional-profile';
import {
  HOSPITAL_LOCATION_REQUIRED_HINT,
  HOSPITAL_NAME_REQUIRED_HINT,
  HOSPITAL_RADIUS_HINT,
  HOSPITAL_SAVE_FAILED_HINT,
  HospitalEditorComponent,
} from './hospital-editor.component';
import { HospitalSiteSource } from './hospital-site-source';
import { ProvisionalHospitalSiteSource } from './provisional-hospital-site-source';

class FakeGeo {
  point: GeoPoint | GeolocationError = { lat: -23.5505, lng: -46.6333 };

  locate(): Promise<GeoPoint> {
    return this.point instanceof GeolocationError ? Promise.reject(this.point) : Promise.resolve(this.point);
  }
}

describe('HospitalEditorComponent', () => {
  let fixture: ComponentFixture<HospitalEditorComponent>;
  let geo: FakeGeo;
  let sites: HospitalSiteSource;
  let saved: jasmine.Spy;
  const added: LinkedHospital[] = [];
  const hospitals = signal<readonly LinkedHospital[]>([{ id: 7, name: 'Hospital Vila Nova Star' }]);
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => root().textContent.replace(/\s+/gu, ' ');
  const controller = (): AssistantEditorController => TestBed.inject(AssistantEditorController);
  const actionIds = (): string[] =>
    controller()
      .active()
      ?.actions()
      .map(a => a.id) ?? [];
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const type = async (id: string, value: string): Promise<void> => {
    const input = root().querySelector(`#${id}`) as HTMLInputElement;

    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const run = async (id: string): Promise<void> => {
    controller().run(id);
    await settle();
  };
  const create = async (initialName = ''): Promise<void> => {
    fixture = TestBed.createComponent(HospitalEditorComponent);
    fixture.componentRef.setInput('initialName', initialName);
    fixture.componentRef.setInput('saved', saved);
    await settle();
  };

  beforeEach(async () => {
    localStorage.clear();
    added.length = 0;
    geo = new FakeGeo();
    saved = jasmine.createSpy('saved');
    TestBed.configureTestingModule({
      providers: [
        { provide: GeolocationService, useValue: geo },
        { provide: HospitalSiteSource, useClass: ProvisionalHospitalSiteSource },
        {
          provide: HospitalContextService,
          useValue: { addLocal: (h: LinkedHospital): number => added.push(h), hospitals },
        },
        { provide: NOW, useValue: (): Date => new Date(2026, 10, 25, 8, 0) },
      ],
    });
    sites = TestBed.inject(HospitalSiteSource);
    await create();
  });

  afterEach(() => localStorage.clear());

  it('mostra nome, endereço, raio (300 m) e a localização ainda não informada; só "usar minha localização" no começo', () => {
    expect(text()).toContain('Nome do hospital');
    expect(text()).toContain('Endereço');
    expect(text()).toContain('Raio de chegada');
    expect((root().querySelector('#hosp-radius') as HTMLInputElement).value).toBe('300');
    expect(text()).toContain('Ainda não informada');
    expect(actionIds()).toEqual(['locate']);
  });

  it('abre com o nome do hospital em contexto', async () => {
    await create('Hospital Vila Nova Star');

    expect((root().querySelector('#hosp-name') as HTMLInputElement).value).toBe('Hospital Vila Nova Star');
  });

  it('usar a localização atual mostra as coordenadas e libera o "Salvar" quando há nome', async () => {
    await type('hosp-name', 'Hospital Novo');
    await run('locate');

    expect(text()).toContain('-23.55050, -46.63330');
    expect(actionIds()).toEqual(['locate', 'save']);
  });

  for (const reason of ['denied', 'timeout', 'unsupported', 'unavailable'] as const) {
    it(`sem posição (${reason}) avisa em texto e não libera o Salvar`, async () => {
      geo.point = new GeolocationError(reason);
      await type('hosp-name', 'Hospital Novo');
      await run('locate');

      expect(root().querySelector('[role="alert"]')).not.toBeNull();
      expect(actionIds()).toEqual(['locate']);
    });
  }

  it('hospital novo: grava a localização, cria o hospital local e fecha o painel', async () => {
    const assistant = TestBed.inject(AiAssistantService);

    spyOn(assistant, 'closePanel');
    await type('hosp-name', 'Hospital Novo');
    await type('hosp-address', 'Rua A, 10');
    await type('hosp-radius', '500');
    await run('locate');
    await run('save');
    const id = -new Date(2026, 10, 25, 8, 0).getTime();

    expect(await sites.load(id)).toEqual({
      address: 'Rua A, 10',
      hospitalId: id,
      lat: -23.5505,
      lng: -46.6333,
      local: true,
      name: 'Hospital Novo',
      radiusMeters: 500,
    });

    expect(added).toEqual([{ id, name: 'Hospital Novo' }]);
    expect(await sites.listLocalHospitals()).toEqual([{ id, name: 'Hospital Novo' }]);
    expect(saved).toHaveBeenCalledOnceWith(id);
    expect(assistant.closePanel).toHaveBeenCalledWith();
  });

  it('nome de hospital já vinculado (sem acento nem caixa): só grava a localização dele', async () => {
    await type('hosp-name', 'hospital vila nova STAR');
    await run('locate');
    await run('save');

    expect(added).toEqual([]);
    expect((await sites.load(7))?.local).toBeUndefined();
    expect((await sites.load(7))?.radiusMeters).toBe(300);
    expect(saved).toHaveBeenCalledOnceWith(7);
    expect(await sites.listLocalHospitals()).toEqual([]);
  });

  it('valida nome, localização e raio antes de gravar', async () => {
    const instance = fixture.componentInstance as unknown as { save(): Promise<void> };

    await instance.save();
    await settle();

    expect(text()).toContain(HOSPITAL_NAME_REQUIRED_HINT);

    await type('hosp-name', 'Hospital Novo');
    await instance.save();
    await settle();

    expect(text()).toContain(HOSPITAL_LOCATION_REQUIRED_HINT);

    await run('locate');
    await type('hosp-radius', '10');
    await run('save');

    expect(text()).toContain(HOSPITAL_RADIUS_HINT);

    await type('hosp-radius', 'abc');
    await run('save');

    expect(text()).toContain(HOSPITAL_RADIUS_HINT);
    expect(saved).not.toHaveBeenCalled();
  });

  it('falha ao gravar avisa e mantém os dados', async () => {
    spyOn(sites, 'save').and.rejectWith(new Error('x'));
    await type('hosp-name', 'Hospital Novo');
    await run('locate');
    await run('save');

    expect(text()).toContain(HOSPITAL_SAVE_FAILED_HINT);
    expect((root().querySelector('#hosp-name') as HTMLInputElement).value).toBe('Hospital Novo');
    expect(saved).not.toHaveBeenCalled();
  });

  it('enquanto lê a posição, ignora outro pedido', async () => {
    const resolvers: ((p: GeoPoint) => void)[] = [];

    spyOn(geo, 'locate').and.callFake(() => new Promise<GeoPoint>(r => resolvers.push(r)));
    controller().run('locate');
    controller().run('locate');
    await settle();

    expect(resolvers.length).toBe(1);
    expect(text()).toContain('Processando');

    resolvers[0]({ lat: 1, lng: 2 });
    await settle();

    expect(text()).toContain('1.00000, 2.00000');
  });

  it('o editor se remove do rodapé ao ser destruído', () => {
    fixture.destroy();

    expect(controller().active()).toBeNull();
  });
});
