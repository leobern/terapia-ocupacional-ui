import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { PatientListComponent } from './patient-list.component';
import { CensusPatient } from './patient-list.models';
import { PatientListSource } from './patient-list-source';

const census = (n: number, name = 'Paciente'): CensusPatient[] =>
  Array.from({ length: n }, (_, i) => ({
    adequacy: { caloric: 80, protein: 70 },
    admissionStatus: 'ADMITTED_BY_EMTN',
    bed: String(i + 1),
    birthDate: '1980-01-01',
    completedCycles: i === 1 ? 0 : 1,
    hospitalId: 'h1',
    id: `p${i}`,
    name: `${name} ${i}`,
    registeredInConductia: true,
    therapy: i === 0 ? 'MISTA' : 'NE',
    therapyStartDate: '2026-01-01',
    ward: 'Ala 1',
  }));

class FakeSource extends PatientListSource {
  result: Promise<readonly CensusPatient[]> = Promise.resolve([]);
  loadCensus(): Promise<readonly CensusPatient[]> {
    return this.result;
  }
}

describe('PatientListComponent', () => {
  let source: FakeSource;
  let fixture: ComponentFixture<PatientListComponent>;
  let router: Router;

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const q = (sel: string): HTMLElement | null => (fixture.nativeElement as HTMLElement).querySelector(sel);

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(PatientListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    source = new FakeSource();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PatientListSource, useValue: source },
        {
          provide: LinkedHospitalsReader,
          useValue: { read: (): { id: string; name: string }[] => [{ id: 'h1', name: 'Hospital Um' }] },
        },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('mostra skeleton enquanto carrega, com o cabeçalho já visível', () => {
    source.result = new Promise<readonly CensusPatient[]>(() => undefined);
    fixture = TestBed.createComponent(PatientListComponent);
    fixture.detectChanges();

    expect(q('.patient-list__skeleton')).not.toBeNull();
    expect(text()).toContain('Hospital Um');
  });

  it('mostra contagem, hospital e cards com iniciais, idade, ala/leito e terapia', async () => {
    source.result = Promise.resolve(census(3));
    await create();

    expect(text()).toContain('3 pacientes');
    expect(text()).toContain('Hospital Um');
    expect(text()).toContain('Ala 1 · Leito 1');
    expect(text()).toContain('VO · NE · NP');
    expect(text()).not.toContain('01/01/1980');
    expect(fixture.nativeElement.querySelectorAll('.patient-list__row').length).toBe(3);
  });

  it('mostra início da terapia, adequação em texto, gauge e primeira avaliação', async () => {
    source.result = Promise.resolve([
      ...census(2),
      { ...census(1)[0], adequacy: null, id: 'n' },
      { ...census(1)[0], adequacy: { caloric: 10, protein: null }, id: 'q' },
    ]);
    await create();

    expect(text()).toContain('Calórica 80% · Proteica 70%');
    expect(text()).toContain('Adequação indisponível');
    expect(text()).not.toContain('0%  ');
    expect(text()).toContain('Calórica 10% · Proteica indisponível');
    expect(text()).toContain('TN há');
    expect(fixture.nativeElement.querySelectorAll('app-graph-meta').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('app-tag').length).toBe(1);
    expect(text()).toContain('Primeira avaliação');
  });

  it('usa singular com um paciente', async () => {
    source.result = Promise.resolve(census(1));
    await create();

    expect(text()).toContain('1 paciente');
    expect(text()).not.toContain('1 pacientes');
  });

  it('não conta paciente não admitido', async () => {
    source.result = Promise.resolve([...census(2), { ...census(1)[0], admissionStatus: 'NOT_ADMITTED', id: 'x' }]);
    await create();

    expect(text()).toContain('2 pacientes');
  });

  it('mostra estado vazio com ação de cadastrar que apenas navega', async () => {
    await create();

    expect(text()).toContain('Nenhum paciente para este dia');
    q('app-button button')?.click();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('mostra erro e tenta de novo', async () => {
    source.result = Promise.reject(new Error('x'));
    await create();

    expect(text()).toContain('Erro ao carregar os pacientes');
    source.result = Promise.resolve(census(2));
    q('app-button button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('2 pacientes');
  });

  it('toque no card abre o paciente e voltar vai para a Home', async () => {
    source.result = Promise.resolve(census(1));
    await create();

    q('.patient-list__row')?.click();

    expect(router.navigate).toHaveBeenCalledWith(['/patients', 'p0']);
    q('.patient-list__back')?.click();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('ignora resposta de carga antiga', async () => {
    source.result = Promise.resolve(census(2));
    await create();
    const comp = fixture.componentInstance;
    let release!: (v: readonly CensusPatient[]) => void;

    source.result = new Promise((r: (v: readonly CensusPatient[]) => void) => (release = r));
    const slow = comp.load('h1');

    source.result = Promise.resolve(census(1));
    await comp.load('h1');
    release(census(5));
    await slow;

    expect(comp.patients().length).toBe(1);
  });
});
