import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClinicalAssessment } from './clinical-assessment.models';
import { ClinicalAssessmentSource } from './clinical-assessment-source';
import { ClinicalTilesComponent } from './clinical-tiles.component';

class FakeSource extends ClinicalAssessmentSource {
  assessment: ClinicalAssessment = {
    device: 'SNE',
    heightCm: 153,
    items: [
      {
        id: 'p',
        ranges: [{ from: 11, label: 'Limítrofe', to: 40, tone: 'warning' }],
        title: 'Panturrilha',
        unit: 'cm',
        value: '31',
      },
    ],
    tnType: 'NE',
    weightKg: 51,
  };
  fails = false;
  loads = 0;

  load(): Promise<ClinicalAssessment> {
    this.loads++;

    return this.fails ? Promise.reject(new Error('x')) : Promise.resolve(this.assessment);
  }

  save(): Promise<void> {
    return Promise.resolve();
  }
}

describe('ClinicalTilesComponent', () => {
  let fixture: ComponentFixture<ClinicalTilesComponent>;
  let source: FakeSource;
  const text = (): string => (fixture.nativeElement as HTMLElement).textContent.replace(/\s+/gu, ' ');
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    source = new FakeSource();
    TestBed.configureTestingModule({ providers: [{ provide: ClinicalAssessmentSource, useValue: source }] });
    fixture = TestBed.createComponent(ClinicalTilesComponent);
    fixture.componentRef.setInput('patientId', 'p1');
  });

  it('mostra tipo de TN, dispositivo e os itens, com o status em texto', async () => {
    await settle();
    const tiles = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="clinical-tile"]'));

    // Tipo de TN, dispositivo, NRS-2002, GLIM e SARC-F (fixos, "Sem dados") e a panturrilha
    expect(tiles.length).toBe(6);
    expect(text()).toContain('Sem dados');
    expect(text()).toContain('Tipo de TNNE enteral');
    expect(text()).toContain('DispositivoSNE sonda');
    expect(text()).toContain('Panturrilha31 cm');
    expect(text()).toContain('Limítrofe');
  });

  it('lê de novo quando a chave de atualização muda', async () => {
    await settle();
    fixture.componentRef.setInput('refreshKey', 1);
    await settle();

    expect(source.loads).toBe(2);
  });

  it('falha na leitura não mostra nada nem quebra', async () => {
    source.fails = true;
    await settle();

    expect(text().trim()).toBe('');
  });
});
