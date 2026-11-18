import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphMetaComponent } from '../graph-meta/graph-meta.component';
import { CardPatientsComponent } from './card-patients.component';

describe('CardPatientsComponent', () => {
  let fixture: ComponentFixture<CardPatientsComponent>;

  async function createWith(overrides: {
    patientCount?: number;
    averageCaloricPercentage?: number;
    averageProteinPercentage?: number;
    actionAriaLabel?: string;
    actionDisabled?: boolean;
  }): Promise<void> {
    await TestBed.configureTestingModule({ imports: [CardPatientsComponent] }).compileComponents();
    fixture = TestBed.createComponent(CardPatientsComponent);
    fixture.componentRef.setInput('patientCount', overrides.patientCount ?? 10);
    fixture.componentRef.setInput('averageCaloricPercentage', overrides.averageCaloricPercentage ?? 62);
    fixture.componentRef.setInput('averageProteinPercentage', overrides.averageProteinPercentage ?? 48);
    fixture.componentRef.setInput('actionAriaLabel', overrides.actionAriaLabel ?? 'Ver listagem de pacientes');
    if (overrides.actionDisabled !== undefined) {
      fixture.componentRef.setInput('actionDisabled', overrides.actionDisabled);
    }
    fixture.detectChanges();
  }

  function title(): string | null {
    const el = fixture.nativeElement.querySelector('.card-patients__title');

    return el ? el.textContent.trim() : null;
  }

  function subtitle(): string {
    return fixture.nativeElement.querySelector('.card-patients__subtitle').textContent.trim();
  }

  function graphMeta(): GraphMetaComponent {
    return fixture.debugElement.query(debug => debug.componentInstance instanceof GraphMetaComponent)
      .componentInstance as GraphMetaComponent;
  }

  // Figma v2/CardPatients: a seta é um <button> de 40px (caret-right) no fim do card.
  function cta(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.card-patients__cta');
  }

  function article(): HTMLElement {
    return fixture.nativeElement.querySelector('.card-patients');
  }

  function subtitleElement(): HTMLElement {
    return fixture.nativeElement.querySelector('.card-patients__subtitle');
  }

  it('patientCount > 0 exibe "N pacientes" no título e "aguardando atendimento hoje" no subtítulo (v2)', async () => {
    await createWith({ patientCount: 10 });

    expect(title()).toBe('10 pacientes');
    expect(subtitle()).toBe('aguardando atendimento hoje');
  });

  it('patientCount = 0 exibe "Todos os pacientes foram atendidos" no título e "metas médias do dia" no subtítulo (v2)', async () => {
    await createWith({ patientCount: 0 });

    expect(title()).toBe('Todos os pacientes foram atendidos');
    expect(subtitle()).toBe('metas médias do dia');
  });

  it('repassa averageCaloricPercentage/averageProteinPercentage sem transformação ao graph-meta interno, mesmo com patientCount = 0 (média dos pacientes já atendidos)', async () => {
    await createWith({ patientCount: 0, averageCaloricPercentage: 62, averageProteinPercentage: 48 });
    const meta = graphMeta();

    expect(meta.topPercentage()).toBe(62);
    expect(meta.bottomPercentage()).toBe(48);
  });

  it('seta fica desabilitado quando patientCount = 0', async () => {
    await createWith({ patientCount: 0 });

    expect(cta().disabled).toBe(true);
  });

  it('seta fica desabilitado quando actionDisabled = true, mesmo com patientCount > 0', async () => {
    await createWith({ patientCount: 10, actionDisabled: true });

    expect(cta().disabled).toBe(true);
  });

  it('seta fica habilitado quando patientCount > 0 e actionDisabled = false', async () => {
    await createWith({ patientCount: 10, actionDisabled: false });

    expect(cta().disabled).toBe(false);
  });

  it('propaga actionAriaLabel como aria-label da seta', async () => {
    await createWith({ actionAriaLabel: 'Ver listagem de pacientes' });

    expect(cta().getAttribute('aria-label')).toBe('Ver listagem de pacientes');
  });

  it('a seta é um botão de 40x40 com caret-right (Figma v2/CardPatients)', async () => {
    await createWith({});
    document.body.appendChild(fixture.nativeElement);

    expect(cta().offsetWidth).toBe(40);
    expect(cta().offsetHeight).toBe(40);
    expect(cta().querySelector('ph-icon')).not.toBeNull();
    fixture.nativeElement.remove();
  });

  describe('área de toque estendida — card inteiro clicável (2026-07-25)', () => {
    it('clicar em qualquer ponto do card (não só no icon-button) emite cardClick quando habilitado', async () => {
      await createWith({ patientCount: 10 });
      const emitted = jasmine.createSpy('emitted');

      fixture.componentInstance.cardClick.subscribe(emitted);

      subtitleElement().click(); // ponto fora do icon-button

      expect(emitted).toHaveBeenCalledTimes(1);
    });

    it('clicar na seta interna também emite cardClick (borbulha para o listener do card)', async () => {
      await createWith({ patientCount: 10 });
      const emitted = jasmine.createSpy('emitted');

      fixture.componentInstance.cardClick.subscribe(emitted);

      fixture.nativeElement.querySelector('.card-patients__cta').click();

      expect(emitted).toHaveBeenCalledTimes(1);
    });

    it('NÃO emite cardClick quando patientCount = 0 (card desabilitado)', async () => {
      await createWith({ patientCount: 0 });
      const emitted = jasmine.createSpy('emitted');

      fixture.componentInstance.cardClick.subscribe(emitted);

      article().click();

      expect(emitted).not.toHaveBeenCalled();
    });

    it('NÃO emite cardClick quando actionDisabled = true, mesmo com patientCount > 0', async () => {
      await createWith({ patientCount: 10, actionDisabled: true });
      const emitted = jasmine.createSpy('emitted');

      fixture.componentInstance.cardClick.subscribe(emitted);

      article().click();

      expect(emitted).not.toHaveBeenCalled();
    });

    it('a seta interna permanece focável/operável por teclado (não vira um segundo controle redundante)', async () => {
      await createWith({ patientCount: 10 });

      expect(article().getAttribute('role')).toBeNull();
      expect(article().getAttribute('tabindex')).toBeNull();
      expect(fixture.nativeElement.querySelector('.card-patients__cta').tabIndex).toBe(0);
    });
  });
});
