import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { NOW } from '../home/professional-profile';
import { PatientHubComponent } from './patient-hub.component';
import { PatientHubProfile } from './patient-hub.models';
import { PatientHubSource } from './patient-hub-source';

const PROFILE: PatientHubProfile = {
  bed: '35',
  birthDate: '1959-04-13',
  id: 'p1',
  name: 'José Raimundo Soares Neto',
  therapy: 'NE',
  therapyStartDate: '2026-05-26',
  ward: 'Ala 2',
};

const locationMock = { back: jasmine.createSpy('back') };

class FakeSource extends PatientHubSource {
  profile: PatientHubProfile | null = PROFILE;
  hypothesis: string | null = 'Insuficiência respiratória aguda.';
  fail = false;

  loadProfile(): Promise<PatientHubProfile | null> {
    return this.fail ? Promise.reject(new Error('x')) : Promise.resolve(this.profile);
  }

  loadHypothesis(): Promise<string | null> {
    return Promise.resolve(this.hypothesis);
  }
}

async function setup(source: FakeSource, id: string | null = 'p1'): Promise<ComponentFixture<PatientHubComponent>> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Location, useValue: locationMock },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(id === null ? {} : { id })) } },
      { provide: PatientHubSource, useValue: source },
      { provide: NOW, useValue: (): Date => new Date(2026, 4, 28, 12) },
      {
        provide: LinkedHospitalsReader,
        useValue: { read: (): unknown[] => [{ id: 'h', name: 'Hospital Vila Nova Star' }] },
      },
    ],
  });
  const fixture = TestBed.createComponent(PatientHubComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

const text = (f: ComponentFixture<unknown>): string => (f.nativeElement as HTMLElement).textContent ?? '';

describe('PatientHubComponent', () => {
  it('mostra identificação e a Hipótese completa quando preenchida', async () => {
    const f = await setup(new FakeSource());

    expect(text(f)).toContain('Hospital Vila Nova Star · Quinta-feira, 28 de maio');
    expect(text(f)).toContain('Ala 2 · Leito 35');
    expect(text(f)).toContain('José Raimundo Soares Neto');
    expect(text(f)).toContain('67 anos · 13/04/1959');
    expect(text(f)).toContain('Terapia há 2 dias');
    expect(text(f)).toContain('Insuficiência respiratória aguda.');
    expect((f.nativeElement as HTMLElement).querySelector('textarea')).toBeNull();
  });

  it('mostra o estado vazio com o campo de colagem quando não há Hipótese', async () => {
    const source = new FakeSource();

    source.hypothesis = null;
    const f = await setup(source);

    expect(text(f)).toContain('Ainda não há hipótese diagnóstica');
    expect((f.nativeElement as HTMLElement).querySelector('textarea')).not.toBeNull();
  });

  it('indica paciente não encontrado', async () => {
    const source = new FakeSource();

    source.profile = null;

    expect(text(await setup(source))).toContain('Paciente não encontrado');
    TestBed.resetTestingModule();

    expect(text(await setup(new FakeSource(), null))).toContain('Paciente não encontrado');
  });

  it('indica erro de carregamento', async () => {
    const source = new FakeSource();

    source.fail = true;

    expect(text(await setup(source))).toContain('Não foi possível carregar');
  });

  it('formata terapia iniciada hoje e no singular, e volta ao histórico', async () => {
    const source = new FakeSource();

    source.profile = { ...PROFILE, birthDate: '1959-06-01', therapyStartDate: '2026-05-28' };
    const f = await setup(source);

    expect(text(f)).toContain('66 anos');
    expect(text(f)).toContain('Terapia iniciada hoje');

    TestBed.resetTestingModule();
    source.profile = { ...PROFILE, therapyStartDate: '2026-05-27' };

    expect(text(await setup(source))).toContain('Terapia há 1 dia');
  });

  it('volta ao clicar na seta', async () => {
    const f = await setup(new FakeSource());

    (f.nativeElement as HTMLElement).querySelector<HTMLElement>('app-icon-button button')?.click();

    expect(locationMock.back).toHaveBeenCalledOnceWith();
  });
});
