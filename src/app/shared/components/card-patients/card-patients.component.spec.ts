import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphMetaComponent } from '../graph-meta/graph-meta.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
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

  function iconButton(): IconButtonComponent {
    return fixture.debugElement.query(debug => debug.componentInstance instanceof IconButtonComponent)
      .componentInstance as IconButtonComponent;
  }

  function article(): HTMLElement {
    return fixture.nativeElement.querySelector('.card-patients');
  }

  function subtitleElement(): HTMLElement {
    return fixture.nativeElement.querySelector('.card-patients__subtitle');
  }

  it('patientCount > 0 exibe "N Pacientes" no título e o subtítulo fixo "Aguardando atendimento"', async () => {
    await createWith({ patientCount: 10 });

    expect(title()).toBe('10 Pacientes');
    expect(subtitle()).toBe('Aguardando atendimento');
  });

  it('patientCount = 0 oculta o título e move a mensagem de "todos atendidos" para o subtítulo', async () => {
    await createWith({ patientCount: 0 });

    expect(title()).toBeNull();
    expect(subtitle()).toBe('Todos os pacientes foram atendidos');
  });

  it('repassa averageCaloricPercentage/averageProteinPercentage sem transformação ao graph-meta interno, mesmo com patientCount = 0 (média dos pacientes já atendidos)', async () => {
    await createWith({ patientCount: 0, averageCaloricPercentage: 62, averageProteinPercentage: 48 });
    const meta = graphMeta();

    expect(meta.topPercentage()).toBe(62);
    expect(meta.bottomPercentage()).toBe(48);
  });

  it('icon-button fica desabilitado quando patientCount = 0', async () => {
    await createWith({ patientCount: 0 });

    expect(iconButton().disabled()).toBe(true);
  });

  it('icon-button fica desabilitado quando actionDisabled = true, mesmo com patientCount > 0', async () => {
    await createWith({ patientCount: 10, actionDisabled: true });

    expect(iconButton().disabled()).toBe(true);
  });

  it('icon-button fica habilitado quando patientCount > 0 e actionDisabled = false', async () => {
    await createWith({ patientCount: 10, actionDisabled: false });

    expect(iconButton().disabled()).toBe(false);
  });

  it('propaga actionAriaLabel como ariaLabel do icon-button', async () => {
    await createWith({ actionAriaLabel: 'Ver listagem de pacientes' });

    expect(iconButton().ariaLabel()).toBe('Ver listagem de pacientes');
  });

  it('icon-button usa kind="secondary" appearance="outlined" size="small" (padrão fixo, Figma nó 4044:2223)', async () => {
    await createWith({});
    const btn = iconButton();

    expect(btn.kind()).toBe('secondary');
    expect(btn.appearance()).toBe('outlined');
    expect(btn.size()).toBe('small');
  });

  describe('área de toque estendida — card inteiro clicável (2026-07-25)', () => {
    it('clicar em qualquer ponto do card (não só no icon-button) emite cardClick quando habilitado', async () => {
      await createWith({ patientCount: 10 });
      const emitted = jasmine.createSpy('emitted');

      fixture.componentInstance.cardClick.subscribe(emitted);

      subtitleElement().click(); // ponto fora do icon-button

      expect(emitted).toHaveBeenCalledTimes(1);
    });

    it('clicar no icon-button interno também emite cardClick (borbulha para o listener do card)', async () => {
      await createWith({ patientCount: 10 });
      const emitted = jasmine.createSpy('emitted');

      fixture.componentInstance.cardClick.subscribe(emitted);

      fixture.nativeElement.querySelector('app-icon-button button').click();

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

    it('o icon-button interno permanece focável/operável por teclado (não vira um segundo controle redundante)', async () => {
      await createWith({ patientCount: 10 });

      expect(article().getAttribute('role')).toBeNull();
      expect(article().getAttribute('tabindex')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-icon-button button').tabIndex).toBe(0);
    });
  });
});
