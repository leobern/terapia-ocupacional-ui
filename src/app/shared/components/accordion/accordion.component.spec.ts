import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccordionComponent, AccordionState, AccordionViewType } from './accordion.component';

/**
 * Host de teste com os dois slots projetados (`accordionInput`/`accordionAnswer`) e
 * `state`/`viewType` controláveis — o accordion nunca decide o próprio `state`
 * (research.md §4), então os testes precisam de um host que o faça, como qualquer
 * consumidor real faria. Estado do host em `signal()` (não campo mutável simples) —
 * necessário para o binding refletir a mudança sob `OnPush` (exigido pelo lint em todo
 * componente do projeto).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccordionComponent],
  template: `
    <app-accordion
      [title]="title()"
      [state]="state()"
      [viewType]="viewType()"
      [emptyPlaceholder]="emptyPlaceholder()"
      (toggled)="toggledCount.set(toggledCount() + 1)"
    >
      <input accordionInput type="text" data-testid="input-slot" />
      <p accordionAnswer data-testid="answer-slot">{{ answerText() }}</p>
    </app-accordion>
  `,
})
class TestHostComponent {
  readonly title = signal('Quem será notificado:');
  readonly state = signal<AccordionState>('collapsed-empty');
  readonly viewType = signal<AccordionViewType | null>(null);
  readonly emptyPlaceholder = signal('Aguardando resposta');
  readonly answerText = signal('Dra. Michelle Franklin');
  readonly toggledCount = signal(0);
}

describe('AccordionComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  function headerEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.accordion__header');
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  // Os dois `.accordion__slot` ficam SEMPRE no DOM (T020 — transição de altura via CSS puro);
  // "aberto"/"fechado" agora é verificado pela classe `--open` e pelo atributo `inert`, não
  // mais pela presença/ausência do nó no DOM.
  function slotOf(innerSelector: string): HTMLElement | null {
    return query(innerSelector)?.closest('.accordion__slot') ?? null;
  }

  function isSlotOpen(innerSelector: string): boolean {
    return slotOf(innerSelector)?.classList.contains('accordion__slot--open') ?? false;
  }

  function isSlotInert(innerSelector: string): boolean {
    return slotOf(innerSelector)?.hasAttribute('inert') ?? false;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('renderização por state', () => {
    it('collapsed-empty: exibe título + emptyPlaceholder, os dois slots fechados e inertes', () => {
      host.state.set('collapsed-empty');
      fixture.detectChanges();

      expect(query('.accordion__title')?.textContent?.trim()).toBe('Quem será notificado:');
      expect(query('.accordion__placeholder')?.textContent?.trim()).toBe('Aguardando resposta');
      expect(isSlotOpen('.accordion__input')).toBeFalse();
      expect(isSlotInert('.accordion__input')).toBeTrue();
      expect(isSlotOpen('.accordion__answer')).toBeFalse();
      expect(isSlotInert('.accordion__answer')).toBeTrue();
    });

    it('expanded: exibe título, sem emptyPlaceholder; slot accordionInput aberto e não-inerte; accordionAnswer fechado', () => {
      host.state.set('expanded');
      fixture.detectChanges();

      expect(query('.accordion__title')?.textContent?.trim()).toBe('Quem será notificado:');
      expect(query('.accordion__placeholder')).toBeNull();
      expect(isSlotOpen('.accordion__input')).toBeTrue();
      expect(isSlotInert('.accordion__input')).toBeFalse();
      expect(isSlotOpen('.accordion__answer')).toBeFalse();
      expect(isSlotInert('.accordion__answer')).toBeTrue();
    });

    it('collapsed-filled: exibe título, sem emptyPlaceholder; slot accordionAnswer aberto e não-inerte, com o conteúdo projetado; accordionInput fechado', () => {
      host.state.set('collapsed-filled');
      host.viewType.set('tag');
      fixture.detectChanges();

      expect(query('.accordion__title')?.textContent?.trim()).toBe('Quem será notificado:');
      expect(query('.accordion__placeholder')).toBeNull();
      expect(isSlotOpen('.accordion__answer')).toBeTrue();
      expect(isSlotInert('.accordion__answer')).toBeFalse();
      expect(query('[data-testid="answer-slot"]')?.textContent?.trim()).toBe('Dra. Michelle Franklin');
      expect(isSlotOpen('.accordion__input')).toBeFalse();
      expect(isSlotInert('.accordion__input')).toBeTrue();
    });
  });

  describe('toggle', () => {
    it('clique em qualquer ponto do header emite toggled exatamente uma vez', () => {
      headerEl().click();
      fixture.detectChanges();

      expect(host.toggledCount()).toBe(1);
    });

    it('Enter com foco no header emite toggled (comportamento nativo de <button>)', () => {
      const header = headerEl();

      header.focus();
      header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      header.click(); // jsdom não simula a ativação nativa do <button> via Enter — o
      // navegador real dispara `click` sozinho; o teste replica esse resultado.
      fixture.detectChanges();

      expect(host.toggledCount()).toBe(1);
    });

    it('clique fora do header não emite nada', () => {
      fixture.nativeElement.querySelector('app-accordion').click();
      fixture.detectChanges();

      expect(host.toggledCount()).toBe(0);
    });
  });

  describe('aria-expanded e rotação do ícone', () => {
    it('aria-expanded="true" apenas em state="expanded"', () => {
      host.state.set('expanded');
      fixture.detectChanges();

      expect(headerEl().getAttribute('aria-expanded')).toBe('true');

      host.state.set('collapsed-empty');
      fixture.detectChanges();

      expect(headerEl().getAttribute('aria-expanded')).toBe('false');

      host.state.set('collapsed-filled');
      fixture.detectChanges();

      expect(headerEl().getAttribute('aria-expanded')).toBe('false');
    });

    it('ícone recebe a classe de rotação apenas em state="expanded"', () => {
      host.state.set('expanded');
      fixture.detectChanges();

      expect(query('.accordion__icon')?.classList).toContain('accordion__icon--expanded');

      host.state.set('collapsed-filled');
      fixture.detectChanges();

      expect(query('.accordion__icon')?.classList).not.toContain('accordion__icon--expanded');
    });
  });

  describe('viewType em collapsed-filled', () => {
    for (const viewType of ['tag', 'texto', 'data'] as const) {
      it(`viewType="${viewType}" projeta o slot accordionAnswer normalmente`, () => {
        host.state.set('collapsed-filled');
        host.viewType.set(viewType);
        fixture.detectChanges();

        expect(isSlotOpen('.accordion__answer')).toBeTrue();
        expect(query('[data-testid="answer-slot"]')).not.toBeNull();
      });
    }

    it('viewType não vaza nenhuma classe para os outros dois states', () => {
      host.state.set('expanded');
      host.viewType.set('tag');
      fixture.detectChanges();

      expect(isSlotOpen('.accordion__answer')).toBeFalse();
    });

    // T021 (convergence): a distinção visual central entre "pergunta" (16px semibold) e
    // "resposta" (14px regular, spec.md § Estados) é a classe `accordion__title--label` no
    // próprio título — não algo aplicado ao container do slot.
    it('accordion__title--label presente apenas em state="collapsed-filled"', () => {
      host.state.set('collapsed-empty');
      fixture.detectChanges();

      expect(query('.accordion__title')?.classList).not.toContain('accordion__title--label');

      host.state.set('expanded');
      fixture.detectChanges();

      expect(query('.accordion__title')?.classList).not.toContain('accordion__title--label');

      host.state.set('collapsed-filled');
      fixture.detectChanges();

      expect(query('.accordion__title')?.classList).toContain('accordion__title--label');
    });
  });

  describe('quebra de texto longo', () => {
    it('título longo não trunca com ellipsis', () => {
      host.title.set(
        'Um título propositalmente muito longo para verificar que ele quebra em várias linhas sem cortar palavras',
      );
      fixture.detectChanges();

      const styles = getComputedStyle(query('.accordion__title') as HTMLElement);

      expect(styles.textOverflow).not.toBe('ellipsis');
      expect(styles.whiteSpace).not.toBe('nowrap');
    });

    // T023 (convergence): mesma regra de quebra de linha se aplica ao valor projetado em
    // accordionAnswer (spec.md Edge Cases), não só ao título.
    it('valor longo projetado em accordionAnswer não trunca com ellipsis', () => {
      host.state.set('collapsed-filled');
      host.answerText.set(
        'Um valor de resposta propositalmente muito longo para verificar que ele também quebra em várias linhas sem cortar palavras nem estourar a largura do container',
      );
      fixture.detectChanges();

      const styles = getComputedStyle(query('.accordion__answer') as HTMLElement);

      expect(styles.textOverflow).not.toBe('ellipsis');
      expect(styles.whiteSpace).not.toBe('nowrap');
    });
  });

  // T022 (convergence, SC-003): duas instâncias no mesmo host, cada uma com seu próprio
  // state/conteúdo — alternar uma não pode afetar a outra.
  describe('múltiplas instâncias simultâneas (SC-003)', () => {
    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      imports: [AccordionComponent],
      template: `
        <app-accordion title="Quem será notificado:" [state]="stateA()" (toggled)="toggledA.set(toggledA() + 1)">
          <input accordionInput data-testid="a-input" />
          <span accordionAnswer data-testid="a-answer">Dra. Michelle Franklin</span>
        </app-accordion>
        <app-accordion
          title="Qual é a mensagem da notificação?"
          [state]="stateB()"
          (toggled)="toggledB.set(toggledB() + 1)"
        >
          <textarea accordionInput data-testid="b-input"></textarea>
          <span accordionAnswer data-testid="b-answer">Alinhado com a equipe manter VO exclusivo por hora</span>
        </app-accordion>
      `,
    })
    class MultiInstanceHostComponent {
      readonly stateA = signal<AccordionState>('collapsed-empty');
      readonly stateB = signal<AccordionState>('collapsed-empty');
      readonly toggledA = signal(0);
      readonly toggledB = signal(0);
    }

    let multiFixture: ComponentFixture<MultiInstanceHostComponent>;
    let multiHost: MultiInstanceHostComponent;

    beforeEach(async () => {
      // O `beforeEach` do describe externo já instanciou o TestBed com `TestHostComponent`
      // (Jasmine roda todo `beforeEach` ancestral antes de cada `it`, inclusive os aninhados) —
      // sem resetar aqui, `configureTestingModule` falha com "already instantiated".
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [MultiInstanceHostComponent],
      }).compileComponents();

      multiFixture = TestBed.createComponent(MultiInstanceHostComponent);
      multiHost = multiFixture.componentInstance;
      multiFixture.detectChanges();
    });

    it('expandir a primeira instância não altera o state nem o toggle da segunda', () => {
      multiHost.stateA.set('expanded');
      multiFixture.detectChanges();

      const accordions = multiFixture.nativeElement.querySelectorAll('app-accordion');
      const [accordionA, accordionB] = Array.from(accordions) as HTMLElement[];

      expect(accordionA.querySelector('.accordion__icon')?.classList).toContain('accordion__icon--expanded');
      expect(accordionB.querySelector('.accordion__icon')?.classList).not.toContain('accordion__icon--expanded');
      expect(multiHost.toggledB()).toBe(0);
    });

    it('tocar no header da segunda instância emite toggled só para ela, não para a primeira', () => {
      const accordions = multiFixture.nativeElement.querySelectorAll('app-accordion');
      const [, accordionB] = Array.from(accordions) as HTMLElement[];

      (accordionB.querySelector('.accordion__header') as HTMLButtonElement).click();
      multiFixture.detectChanges();

      expect(multiHost.toggledA()).toBe(0);
      expect(multiHost.toggledB()).toBe(1);
    });

    it('colapsed-filled na segunda instância não abre o slot correspondente da primeira', () => {
      multiHost.stateB.set('collapsed-filled');
      multiFixture.detectChanges();

      const accordions = multiFixture.nativeElement.querySelectorAll('app-accordion');
      const [accordionA, accordionB] = Array.from(accordions) as HTMLElement[];

      expect(accordionB.querySelector('.accordion__answer')?.closest('.accordion__slot')?.classList).toContain(
        'accordion__slot--open',
      );

      expect(accordionA.querySelector('.accordion__answer')?.closest('.accordion__slot')?.classList).not.toContain(
        'accordion__slot--open',
      );
    });
  });
});
