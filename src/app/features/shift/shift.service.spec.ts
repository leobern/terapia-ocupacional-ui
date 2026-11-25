import { TestBed } from '@angular/core/testing';

import { GeolocationError, GeolocationService, GeoPoint } from '../../shared/services/geolocation.service';
import { NOW, ProfessionalProfileReader } from '../home/professional-profile';
import { HospitalSiteSource } from './hospital-site-source';
import { ProvisionalHospitalSiteSource } from './provisional-hospital-site-source';
import { ProvisionalShiftSource } from './provisional-shift-source';
import { HospitalSite, Shift } from './shift.models';
import { shiftFailureMessage, ShiftService } from './shift.service';
import { ShiftSource } from './shift-source';

class FakeGeo {
  point: GeoPoint | GeolocationError = { lat: -23.5505, lng: -46.6333 };

  locate(): Promise<GeoPoint> {
    return this.point instanceof GeolocationError ? Promise.reject(this.point) : Promise.resolve(this.point);
  }
}

const SITE: HospitalSite = { address: 'Centro', hospitalId: 1, lat: -23.5505, lng: -46.6333, radiusMeters: 300 };

describe('ShiftService', () => {
  let service: ShiftService;
  let geo: FakeGeo;
  let sites: HospitalSiteSource;
  let shiftSource: ShiftSource;
  let who: { name: string; role: 'doctor' | 'other' };

  beforeEach(() => {
    localStorage.clear();
    geo = new FakeGeo();
    who = { name: 'Dra. Ana', role: 'doctor' };
    TestBed.configureTestingModule({
      providers: [
        { provide: GeolocationService, useValue: geo },
        { provide: HospitalSiteSource, useClass: ProvisionalHospitalSiteSource },
        { provide: ShiftSource, useClass: ProvisionalShiftSource },
        { provide: ProfessionalProfileReader, useValue: { read: (): typeof who => who } },
        { provide: NOW, useValue: (): Date => new Date(2026, 10, 25, 8, 0) },
      ],
    });
    service = TestBed.inject(ShiftService);
    sites = TestBed.inject(HospitalSiteSource);
    shiftSource = TestBed.inject(ShiftSource);
  });

  afterEach(() => localStorage.clear());

  it('sem localização cadastrada para o hospital, não inicia e orienta a cadastrar', async () => {
    const result = await service.start(1);

    expect(result.ok).toBeFalse();
    expect(result.reason).toBe('no-site');
    expect(shiftFailureMessage(result)).toContain('Cadastrar hospital');
  });

  it('dentro do raio, inicia o turno do profissional e ele aparece em "mine"', async () => {
    await sites.save(SITE);
    const result = await service.start(1);

    expect(result.ok).toBeTrue();
    expect(service.mine()?.professionalName).toBe('Dra. Ana');
    expect(service.mine()?.professionalRole).toBe('Médico');
    expect(service.mine()?.patientIds).toEqual([]);
  });

  it('fora do raio, não inicia e informa a distância em texto', async () => {
    await sites.save(SITE);
    geo.point = { lat: -23.5505 + 0.0135, lng: -46.6333 };
    const result = await service.start(1);

    expect(result.ok).toBeFalse();
    expect(result.reason).toBe('outside');
    expect(shiftFailureMessage(result)).toContain('1,5 km');
    expect(shiftFailureMessage(result)).toContain('300 m');
    expect(service.mine()).toBeNull();
  });

  it('perto, porém fora do raio, a distância sai em metros', () => {
    expect(shiftFailureMessage({ distanceMeters: 420, ok: false, radiusMeters: 300, reason: 'outside' })).toContain(
      '420 m',
    );
  });

  for (const reason of ['denied', 'timeout', 'unavailable', 'unsupported'] as const) {
    it(`sem posição (${reason}), não inicia e orienta em texto`, async () => {
      await sites.save(SITE);
      geo.point = new GeolocationError(reason);
      const result = await service.start(1);

      expect(result.reason).toBe(reason);
      expect(shiftFailureMessage(result).length).toBeGreaterThan(10);
    });
  }

  it('erro inesperado vira falha genérica', async () => {
    spyOn(sites, 'load').and.rejectWith(new Error('x'));
    const result = await service.start(1);

    expect(result.reason).toBe('error');
    expect(shiftFailureMessage(result)).toContain('Tente de novo');
  });

  it('outro profissional em turno aparece em "others" com os pacientes que escolheu', async () => {
    const other = await shiftSource.start({
      hospitalId: 1,
      professionalName: 'Dr. Bruno',
      professionalRole: 'Médico',
      startedAt: new Date(2026, 10, 25, 7, 0).toISOString(),
    });

    await shiftSource.selectPatients(other.id, ['p1', 'p2']);
    await service.refresh(1);

    expect(service.mine()).toBeNull();
    expect(service.others().map(s => s.professionalName)).toEqual(['Dr. Bruno']);
    expect(service.takenBy().get('p1')).toBe('Dr. Bruno');
    expect(service.takenBy().get('p9')).toBeUndefined();
  });

  it('grava os pacientes escolhidos e encerra o turno', async () => {
    await sites.save(SITE);
    await service.start(1);
    await service.savePatients(['p3']);

    expect(service.mine()?.patientIds).toEqual(['p3']);

    await service.end();

    expect(service.mine()).toBeNull();
  });

  it('sem turno iniciado, escolher pacientes ou encerrar não faz nada', async () => {
    await service.savePatients(['p1']);
    await service.end();

    expect(service.shifts()).toEqual([]);
  });

  it('falha ao ler os turnos mantém os que já estavam', async () => {
    await sites.save(SITE);
    await service.start(1);
    spyOn(shiftSource, 'listActive').and.rejectWith(new Error('x'));
    await service.refresh(1);

    expect(service.mine()).not.toBeNull();
  });

  it('turno com mais de 14 horas deixa de valer', async () => {
    localStorage.setItem(
      'conductia:shifts',
      JSON.stringify([
        {
          hospitalId: 1,
          id: 'velho',
          patientIds: [],
          professionalName: 'Dr. Velho',
          professionalRole: 'Médico',
          startedAt: new Date(2026, 10, 24, 8, 0).toISOString(),
        } satisfies Shift,
      ]),
    );
    await service.refresh(1);

    expect(service.shifts()).toEqual([]);
  });

  it('iniciar de novo substitui o turno anterior do mesmo profissional', async () => {
    await sites.save(SITE);
    await service.start(1);
    await service.start(1);

    expect(service.shifts().length).toBe(1);
  });

  it('profissional que não é médico entra como equipe multiprofissional', async () => {
    who = { name: 'Nutri Clara', role: 'other' };
    await sites.save(SITE);
    await service.start(1);

    expect(service.mine()?.professionalRole).toBe('Equipe multiprofissional');
  });

  it('a localização do hospital é gravada e lida de volta', async () => {
    await sites.save(SITE);

    expect(await sites.load(1)).toEqual(SITE);
    expect(await sites.load(2)).toBeNull();
  });
});
