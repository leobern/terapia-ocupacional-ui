import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { HospitalLinksComponent, REQUEST_HOSPITAL_LINK_URL } from './hospital-links.component';
import { HospitalLink, HospitalLinkStatus } from './hospital-links.models';
import { HospitalLinksSource } from './hospital-links-source';

const link = (id: number, hospitalName: string, status: HospitalLinkStatus): HospitalLink => ({
  hospitalId: id,
  hospitalName,
  id,
  status,
  updatedAt: '2026-11-20T10:00:00Z',
});

describe('HospitalLinksComponent', () => {
  let fixture: ComponentFixture<HospitalLinksComponent>;
  let list: jasmine.Spy;

  const text = (): string => fixture.nativeElement.textContent;
  const button = (label: string): HTMLElement | undefined =>
    Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('app-button')).find(el =>
      el.textContent?.includes(label),
    );

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(HospitalLinksComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    list = jasmine.createSpy('list');
    TestBed.configureTestingModule({ providers: [{ provide: HospitalLinksSource, useValue: { list } }] });
  });

  it('mostra o carregamento enquanto a lista não chega', () => {
    list.and.returnValue(new Promise(() => undefined));
    fixture = TestBed.createComponent(HospitalLinksComponent);
    fixture.detectChanges();

    expect(text()).toContain('Carregando');
  });

  it('lista cada hospital com o texto do status, nos 4 estados, e o botão de adicionar', async () => {
    list.and.resolveTo({
      hasApprovedLink: true,
      items: [
        link(1, 'Alfa', 'approved'),
        link(2, 'Beta', 'pending'),
        link(3, 'Gama', 'refused'),
        link(4, 'Delta', 'revoked'),
      ],
    });
    await render();

    const items = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.hospital-links__item')).map(el =>
      el.textContent.replace(/\s+/g, ' ').trim(),
    );

    expect(items).toEqual(['Alfa Aprovado', 'Beta Aguardando aprovação', 'Gama Recusado', 'Delta Revogado']);

    expect(fixture.nativeElement.querySelectorAll('.hospital-links__item ph-icon').length).toBe(4);
    expect(button('Solicitar acesso a outro hospital')).toBeDefined();
  });

  it('com lista vazia mostra a orientação e o botão que inicia a solicitação', async () => {
    list.and.resolveTo({ hasApprovedLink: false, items: [] });
    await render();
    const router = TestBed.inject(Router);

    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    expect(text()).toContain('Você ainda não tem vínculos');
    expect(text()).toContain('Solicite acesso ao seu primeiro hospital');

    button('Solicitar acesso a um hospital')?.querySelector('button')?.click();

    expect(router.navigateByUrl).toHaveBeenCalledWith(REQUEST_HOSPITAL_LINK_URL);
  });

  it('em caso de erro mostra o aviso e tenta de novo', async () => {
    list.and.rejectWith(new Error('falha'));
    await render();

    expect(text()).toContain('Não foi possível carregar seus vínculos');

    list.and.resolveTo({ hasApprovedLink: true, items: [link(1, 'Alfa', 'approved')] });
    button('Tentar novamente')?.querySelector('button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('Alfa');
    expect(text()).not.toContain('Não foi possível');
  });
});
