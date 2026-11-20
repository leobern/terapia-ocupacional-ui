import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { NutritionCardModalComponent } from './nutrition-card-modal.component';
import { NutritionHiddenCards, NutritionHistorySource, NutritionValueWriter } from './nutrition-card-ports';
import { ProvisionalNutritionCardStore } from './provisional-nutrition-card-store';

describe('NutritionCardModalComponent', () => {
  let fixture: ComponentFixture<NutritionCardModalComponent>;
  let store: ProvisionalNutritionCardStore;

  const dialog = (): HTMLDialogElement => fixture.nativeElement.querySelector('dialog');
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  // Chama o método protegido sem passar pelo DOM (o botão fica desabilitado em alguns estados).
  const save = (): Promise<void> => (fixture.componentInstance as unknown as { save(): Promise<void> }).save();

  beforeEach(() => {
    store = new ProvisionalNutritionCardStore();
    TestBed.configureTestingModule({
      providers: [
        { provide: NutritionHistorySource, useValue: store },
        { provide: NutritionValueWriter, useValue: store },
        { provide: NutritionHiddenCards, useValue: store },
        { provide: ProfessionalProfileReader, useValue: { read: (): { name: string } => ({ name: 'Michelle' }) } },
        { provide: NOW, useValue: (): Date => new Date(2026, 4, 28, 12) },
      ],
    });
    fixture = TestBed.createComponent(NutritionCardModalComponent);
  });

  it('fica fechado sem indicador', async () => {
    await settle();

    expect(dialog().open).toBe(false);
  });

  it('não grava sem paciente ou sem indicador', async () => {
    fixture.componentRef.setInput('indicator', 'weight');
    await settle();
    await save();

    expect(store.auditTrail.length).toBe(0);
    expect(fixture.nativeElement.textContent).not.toContain('Histórico desta internação');
  });

  it('offline: chamada direta a salvar não grava e mostra a conexão necessária', async () => {
    fixture.componentRef.setInput('indicator', 'weight');
    fixture.componentRef.setInput('patientId', 'p1');
    TestBed.inject(ConnectivityService).online.set(false);
    await settle();
    await save();
    await settle();

    expect(store.auditTrail.length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Conexão necessária para salvar o valor.');
  });

  it('falha ao carregar o histórico mantém o modal utilizável', async () => {
    spyOn(store, 'load').and.rejectWith(new Error('x'));
    fixture.componentRef.setInput('indicator', 'weight');
    fixture.componentRef.setInput('patientId', 'p1');
    await settle();

    expect(dialog().open).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Ainda sem valor');
  });

  it('fecha o dialog quando o indicador volta a nulo', async () => {
    fixture.componentRef.setInput('indicator', 'weight');
    fixture.componentRef.setInput('patientId', 'p1');
    await settle();
    fixture.componentRef.setInput('indicator', null);
    await settle();

    expect(dialog().open).toBe(false);
  });

  describe('apagar entrada do histórico', () => {
    const seed = async (): Promise<void> => {
      const edit = (value: string, previous: string | null): Promise<void> =>
        store.save({
          at: new Date(2026, 4, 20).toISOString(),
          author: 'Ana',
          indicator: 'weight',
          newOrigin: 'manual',
          patientId: 'p1',
          previous: previous === null ? null : { at: null, origin: 'manual', value: previous },
          value,
        });

      await edit('50', null);
      await edit('51', '50');
      await edit('52', '51');
      fixture.componentRef.setInput('indicator', 'weight');
      fixture.componentRef.setInput('patientId', 'p1');
      fixture.componentRef.setInput('current', { at: null, origin: 'manual', value: '52' });
      await settle();
    };
    const buttons = (): HTMLButtonElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll('.card-modal__entry button'));
    const values = (): string[] =>
      Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.card-modal__entry-value')).map(
        e => e.textContent?.trim() ?? '',
      );

    it('apaga só a entrada escolhida, audita e mantém o valor atual', async () => {
      await seed();

      expect(values()).toEqual(['51', '50']);
      expect(buttons()[0].getAttribute('aria-label')).toBe('Apagar entrada 51, 20/05');

      buttons()[0].click();
      await settle();

      expect(values()).toEqual(['50']);
      expect(store.deletionAuditTrail.length).toBe(1);
      expect(store.deletionAuditTrail[0]).toEqual(
        jasmine.objectContaining({ author: 'Michelle', indicator: 'weight', patientId: 'p1' }),
      );

      expect(store.deletionAuditTrail[0].entry.value).toBe('51');
      expect(store.auditTrail.length).toBe(3);
      expect(fixture.nativeElement.textContent).toContain('Valor atual');
      expect((await store.loadManual('p1')).weight?.value).toBe('52');
      expect((await store.load('p1', 'weight')).map(e => e.value)).toEqual(['50']);
    });

    it('apagar a última entrada esconde a seção do histórico', async () => {
      await seed();
      buttons()[0].click();
      await settle();
      buttons()[0].click();
      await settle();

      expect(fixture.nativeElement.textContent).not.toContain('Histórico desta internação');
      expect(store.deletionAuditTrail.length).toBe(2);
    });

    it('offline: desabilita apagar e explica; chamada direta não grava', async () => {
      await seed();
      TestBed.inject(ConnectivityService).online.set(false);
      await settle();

      expect(buttons()[0].disabled).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Conexão necessária para apagar a entrada.');
      const entry = (await store.load('p1', 'weight'))[0];

      await (fixture.componentInstance as unknown as { deleteEntry(e: unknown): Promise<void> }).deleteEntry(entry);

      expect(store.deletionAuditTrail.length).toBe(0);
    });

    it('falha na gravação mantém a entrada e mostra erro em texto', async () => {
      await seed();
      spyOn(store, 'deleteEntry').and.rejectWith(new Error('x'));
      buttons()[0].click();
      await settle();

      expect(values()).toEqual(['51', '50']);
      expect(fixture.nativeElement.textContent).toContain('Não foi possível apagar a entrada.');
    });

    it('sem paciente não grava', async () => {
      await seed();
      fixture.componentRef.setInput('patientId', null);
      await settle();
      const entry = (await store.load('p1', 'weight'))[0];

      await (fixture.componentInstance as unknown as { deleteEntry(e: unknown): Promise<void> }).deleteEntry(entry);

      expect(store.deletionAuditTrail.length).toBe(0);
    });
  });

  describe('ocultar do painel (US6)', () => {
    const hide = (): Promise<void> => (fixture.componentInstance as unknown as { hide(): Promise<void> }).hide();

    it('sem paciente ou indicador não grava nada', async () => {
      await settle();
      await hide();

      expect(await store.loadHidden('p1')).toEqual([]);
    });

    it('offline: chamada direta não grava e mostra a conexão necessária', async () => {
      fixture.componentRef.setInput('indicator', 'weight');
      fixture.componentRef.setInput('patientId', 'p1');
      TestBed.inject(ConnectivityService).online.set(false);
      await settle();
      await hide();
      await settle();

      expect(await store.loadHidden('p1')).toEqual([]);
      expect(fixture.nativeElement.textContent).toContain('Conexão necessária para ocultar o card.');
      TestBed.inject(ConnectivityService).online.set(true);
    });

    it('grava a ocultação e emite o indicador', async () => {
      const emitted: string[] = [];

      fixture.componentInstance.hidden.subscribe(i => emitted.push(i));
      fixture.componentRef.setInput('indicator', 'weight');
      fixture.componentRef.setInput('patientId', 'p1');
      await settle();
      await hide();

      expect(emitted).toEqual(['weight']);
      expect(await store.loadHidden('p1')).toEqual(['weight']);
    });
  });
});
