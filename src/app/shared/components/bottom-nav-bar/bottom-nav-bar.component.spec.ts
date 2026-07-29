import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { BottomNavBarComponent } from './bottom-nav-bar.component';

/**
 * NOTA DE COBERTURA: `aria-haspopup`/`aria-expanded` (spec.md FR-016) ainda não são
 * testados aqui porque ainda não são implementáveis — nem `app-icon-button` nem
 * `app-icon-logo-button` repassam atributos ARIA ao `<button>` interno. A lacuna
 * está registrada em specs/ds/DS-component-bottom-nav-bar/tasks.md (T010b) e no
 * docblock do componente; fecha com `/speckit-design` nas duas entries.
 */
describe('BottomNavBarComponent', () => {
  let fixture: ComponentFixture<BottomNavBarComponent>;
  let component: BottomNavBarComponent;

  /** Os 3 controles, na ordem em que aparecem no DOM (= ordem de tabulação). */
  function buttons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button'));
  }

  function aiLabelElement(): HTMLElement {
    return fixture.nativeElement.querySelector('.bottom-nav-bar__ai-label');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BottomNavBarComponent] }).compileComponents();

    fixture = TestBed.createComponent(BottomNavBarComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it('renderiza exatamente 3 controles focáveis', () => {
    expect(buttons().length).toBe(3);
  });

  it('mantém a ordem no DOM menu → IA → ações', () => {
    // A ordem importa: o cluster de IA é posicionado de forma ABSOLUTA, então a
    // ordem visual só coincide com a de foco se o DOM seguir esta sequência
    // (spec.md FR-007).
    const labels = buttons().map(button => button.getAttribute('aria-label'));

    expect(labels).toEqual(['Abrir menu', 'Abrir assistente de IA', 'Ações desta tela']);
  });

  it('emite menuClick ao acionar o botão da esquerda', () => {
    let emitted = false;

    component.menuClick.subscribe(() => (emitted = true));
    buttons()[0].click();

    expect(emitted).toBeTrue();
  });

  it('emite aiClick ao acionar o gatilho central', () => {
    let emitted = false;

    component.aiClick.subscribe(() => (emitted = true));
    buttons()[1].click();

    expect(emitted).toBeTrue();
  });

  it('emite actionsClick ao acionar o botão da direita', () => {
    let emitted = false;

    component.actionsClick.subscribe(() => (emitted = true));
    buttons()[2].click();

    expect(emitted).toBeTrue();
  });

  it('renderiza o convite padrão do Figma', () => {
    expect(aiLabelElement().textContent?.trim()).toBe('Como eu posso te ajudar?');
  });

  it('aceita um convite customizado via aiLabel', () => {
    fixture.componentRef.setInput('aiLabel', 'Precisa de ajuda?');
    fixture.detectChanges();

    expect(aiLabelElement().textContent?.trim()).toBe('Precisa de ajuda?');
  });

  it('esconde o texto do convite de leitores de tela (evita leitura dupla do nome do botão)', () => {
    expect(aiLabelElement().getAttribute('aria-hidden')).toBe('true');
  });

  it('trunca o convite dinâmico em uma linha em vez de quebrar ou invadir os botões', () => {
    // O convite muda por tela/horário/ação (spec.md § Clarifications). Quebrar em
    // duas linhas empurraria o símbolo para cima e desfaria o transbordo de 8px,
    // então a regra é truncar (spec.md FR-017).
    fixture.componentRef.setInput(
      'aiLabel',
      'Um convite dinâmico absurdamente longo que jamais caberia na largura livre entre os dois botões laterais da barra',
    );
    fixture.detectChanges();

    const estilo = getComputedStyle(aiLabelElement());

    expect(estilo.whiteSpace).toBe('nowrap');
    expect(estilo.textOverflow).toBe('ellipsis');
    expect(estilo.overflow).toBe('hidden');
  });

  it('expõe a barra como landmark de navegação', () => {
    const nav: HTMLElement = fixture.nativeElement.querySelector('nav');

    expect(nav.getAttribute('aria-label')).toBe('Navegação principal');
  });

  it('não desabilita nenhum dos 3 controles', () => {
    // O visual `disabled` do icon-button pinta um retângulo cinza e destruiria a
    // barra chromeless — por isso a barra não expõe `disabled` por slot
    // (spec.md § Edge Cases).
    expect(buttons().every(button => !button.disabled)).toBeTrue();
  });
});
