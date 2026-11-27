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

  describe('progressão do valor', () => {
    const button = (label: string): HTMLButtonElement | undefined =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button.tiles__face')).find(
        b => b.textContent.includes(label),
      );

    it('só os itens com número viram botão; tipo de TN, dispositivo e itens sem dados não', async () => {
      await settle();

      expect(button('Panturrilha')).toBeDefined();
      expect(button('Tipo de TN')).toBeUndefined();
      expect(button('NRS-2002')).toBeUndefined();
    });

    it('tocar no card abre o gráfico de progressão e o botão de fechar minimiza', async () => {
      await settle();
      button('Panturrilha')?.click();
      await settle();
      const root = fixture.nativeElement as HTMLElement;

      expect(root.querySelector('app-measure-chart')).not.toBeNull();
      expect(root.textContent).toContain('6 medições');
      expect(button('Panturrilha')).toBeUndefined();

      (root.querySelector('app-icon-button button') as HTMLButtonElement).click();
      await settle();
      await new Promise(resolve => setTimeout(resolve, 500));
      fixture.detectChanges();

      expect(root.querySelector('app-measure-chart')).toBeNull();
    });

    it('ao minimizar, o card volta ao estado inicial e pode ser aberto de novo', async () => {
      await settle();
      button('Panturrilha')?.click();
      await settle();
      (fixture.nativeElement.querySelector('app-icon-button button') as HTMLButtonElement).click();
      await settle();
      await new Promise(resolve => setTimeout(resolve, 500));
      fixture.detectChanges();

      expect(button('Panturrilha')).toBeDefined();
    });
  });
});
