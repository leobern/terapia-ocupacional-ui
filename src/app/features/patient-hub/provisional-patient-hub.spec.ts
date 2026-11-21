import { TestBed } from '@angular/core/testing';

import { FollowUpClosureSource } from '../follow-up-closure/follow-up-closure-source';
import { ProvisionalFollowUpClosureSource } from '../follow-up-closure/provisional-follow-up-closure';
import { PatientListSource } from '../patient-list/patient-list-source';
import { ProvisionalPatientListSource } from '../patient-list/provisional-patient-list';
import {
  ProvisionalHypothesisSynthesizer,
  ProvisionalHypothesisWriter,
  ProvisionalPatientHubSource,
  ProvisionalPriorStaysSource,
  ProvisionalPriorStaysSynthesizer,
} from './provisional-patient-hub';

describe('Provisional do Hub do paciente', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        ProvisionalPatientHubSource,
        { provide: PatientListSource, useClass: ProvisionalPatientListSource },
        { provide: FollowUpClosureSource, useClass: ProvisionalFollowUpClosureSource },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  it('lê o perfil do censo e devolve null para id desconhecido', async () => {
    const source = TestBed.inject(ProvisionalPatientHubSource);

    expect((await source.loadProfile('p1'))?.id).toBe('p1');
    expect(await source.loadProfile('nao-existe')).toBeNull();
  });

  it('lê a Hipótese semente, nula para quem não tem, e a gravada pelo writer (cache local)', async () => {
    const source = TestBed.inject(ProvisionalPatientHubSource);

    expect(await source.loadHypothesis('p1')).toContain('Insuficiência respiratória');
    expect(await source.loadHypothesis('p3')).toBeNull();

    await new ProvisionalHypothesisWriter().save({
      at: '2026-05-28T12:00:00Z',
      author: 'A',
      origin: 'manual',
      patientId: 'p3',
      text: 'Gravada',
    });

    expect(await source.loadHypothesis('p3')).toBe('Gravada');
  });

  it('sintetiza um resumo curto, truncando textos longos', async () => {
    const synth = new ProvisionalHypothesisSynthesizer();

    expect(await synth.synthesize('  a   b ')).toBe('a b');
    expect((await synth.synthesize('x'.repeat(500))).length).toBe(240);
  });
});

describe('Provisório de internações anteriores', () => {
  it('só o paciente de exemplo tem histórico no hospital de exemplo', async () => {
    const source = new ProvisionalPriorStaysSource();
    const synth = new ProvisionalPriorStaysSynthesizer();

    expect(await source.hasPriorStays('p1', 'hospital-vila-nova-star')).toBeTrue();
    expect(await source.hasPriorStays('p1', 'outro-hospital')).toBeFalse();
    expect(await source.hasPriorStays('p2', 'hospital-vila-nova-star')).toBeFalse();
    expect(await synth.synthesize('p1', 'hospital-vila-nova-star')).toContain('Internação anterior');
    await expectAsync(synth.synthesize('p2', 'hospital-vila-nova-star')).toBeRejected();
  });
});
