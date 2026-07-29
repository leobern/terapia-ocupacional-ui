import { type ComponentFixture, TestBed } from '@angular/core/testing';

import {
  AudioCaptureFailure,
  type AudioCaptureHandle,
  AudioCaptureService,
} from '../../services/audio-capture.service';
import { InputChatComponent } from './input-chat.component';

/**
 * Captura fake — é o que torna determinísticos os critérios que, com hardware
 * real, dependeriam de permissão e microfone: fórmula de amplitude, par
 * cancelar/enviar e cleanup (research.md §5/§9).
 */
class FakeAudioCaptureService {
  readonly disposed = jasmine.createSpy('dispose');
  readonly collected = jasmine.createSpy('stopAndCollect');

  blob = new Blob(['audio-bytes'], { type: 'audio/webm;codecs=opus' });
  failure: AudioCaptureFailure | null = null;
  handle: AudioCaptureHandle | null = null;

  start(): Promise<AudioCaptureHandle> {
    if (this.failure) {
      return Promise.reject(this.failure);
    }

    this.handle = {
      dispose: this.disposed,
      readFrame: (out: Float32Array): Float32Array => out.fill(0.5),
      stopAndCollect: (): Promise<Blob> => {
        this.collected();

        return Promise.resolve(this.blob);
      },
    };

    return Promise.resolve(this.handle);
  }
}

describe('InputChatComponent', () => {
  let fixture: ComponentFixture<InputChatComponent>;
  let capture: FakeAudioCaptureService;

  function shellEl(): HTMLElement {
    return fixture.nativeElement.querySelector('.input-chat__shell');
  }

  function fieldEl(): HTMLTextAreaElement {
    return fixture.nativeElement.querySelector('.input-chat__field');
  }

  function mainButtonEl(): HTMLElement {
    // O botão principal é sempre o último `app-icon-button` da row (o de
    // cancelar, quando existe, vem antes no DOM).
    const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('app-icon-button button'));

    return buttons[buttons.length - 1];
  }

  function cancelButtonEl(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.input-chat__cancel button');
  }

  async function enterAudioMode(): Promise<void> {
    mainButtonEl().click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // `getBoundingClientRect`/`offsetHeight` só refletem layout real com o
  // elemento anexado ao documento vivo — mesmo padrão já usado em
  // `input-select.component.spec.ts`. É o que torna SC-003/SC-004 verificáveis
  // aqui em vez de dependerem de inspeção manual no navegador.
  let attachedContainer: HTMLElement | null = null;

  function attachToDom(containerWidthPx = 600): HTMLElement {
    const container = document.createElement('div');

    container.style.width = `${containerWidthPx}px`;
    container.appendChild(fixture.nativeElement);
    document.body.appendChild(container);
    attachedContainer = container;
    fixture.detectChanges();

    return container;
  }

  function setValue(text: string): void {
    const field = fieldEl();

    field.value = text;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  afterEach(() => {
    attachedContainer?.remove();
    attachedContainer = null;
  });

  beforeEach(async () => {
    capture = new FakeAudioCaptureService();

    await TestBed.configureTestingModule({
      imports: [InputChatComponent],
      providers: [{ provide: AudioCaptureService, useValue: capture }],
    }).compileComponents();

    fixture = TestBed.createComponent(InputChatComponent);
    fixture.componentRef.setInput('placeholder', 'Escreva a sua mensagem');
    fixture.detectChanges();
  });

  describe('campo de texto (US1)', () => {
    it('renderiza um <textarea>, nao um <input> — o campo e multi-linha', () => {
      expect(fieldEl().tagName).toBe('TEXTAREA');
    });

    it('mostra o placeholder quando vazio e sem foco', () => {
      expect(fieldEl().placeholder).toBe('Escreva a sua mensagem');
    });

    it('esconde o placeholder ao focar, mesmo antes de digitar', () => {
      fieldEl().dispatchEvent(new Event('focus'));
      fixture.detectChanges();

      expect(fieldEl().placeholder).toBe('');
    });

    it('mostra o placeholder de novo ao perder o foco com o campo vazio', () => {
      fieldEl().dispatchEvent(new Event('focus'));
      fixture.detectChanges();
      fieldEl().dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(fieldEl().placeholder).toBe('Escreva a sua mensagem');
    });

    it('propaga a digitacao para o model `value`', () => {
      fieldEl().value = 'ola';
      fieldEl().dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(fixture.componentInstance.value()).toBe('ola');
    });

    it('aplica a classe de preenchido quando ha valor', () => {
      fixture.componentRef.setInput('value', 'ola');
      fixture.detectChanges();

      expect(fieldEl().classList).toContain('input-chat__field--filled');
    });

    it('trata valor so com espacos e quebras de linha como vazio (FR-009)', () => {
      fixture.componentRef.setInput('value', '   \n\t  ');
      fixture.detectChanges();

      expect(fieldEl().classList).not.toContain('input-chat__field--filled');
    });

    it('nao normaliza o valor digitado — o usuario continua vendo o que escreveu', () => {
      fixture.componentRef.setInput('value', '   ');
      fixture.detectChanges();

      expect(fieldEl().value).toBe('   ');
    });

    it('aplica `maxHeight` (default 160px do Figma) ao elemento rolavel', () => {
      expect(shellEl().style.maxHeight).toBe('160px');
    });

    it('permite sobrescrever `maxHeight`', () => {
      fixture.componentRef.setInput('maxHeight', 240);
      fixture.detectChanges();

      expect(shellEl().style.maxHeight).toBe('240px');
    });

    it('desabilita o campo quando `disabled`', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      expect(fieldEl().disabled).toBeTrue();
      expect(shellEl().classList).toContain('input-chat__shell--disabled');
    });
  });

  describe('foco por teclado', () => {
    it('marca `keyboard-focus` quando o foco chega via teclado', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      fieldEl().dispatchEvent(new Event('focus'));
      fixture.detectChanges();

      expect(shellEl().classList).toContain('keyboard-focus');
    });

    it('nao marca `keyboard-focus` quando o foco chega por clique de mouse', () => {
      document.dispatchEvent(new MouseEvent('mousedown'));
      fieldEl().dispatchEvent(new Event('focus'));
      fixture.detectChanges();

      expect(shellEl().classList).not.toContain('keyboard-focus');
    });

    it('remove `keyboard-focus` ao perder o foco', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      fieldEl().dispatchEvent(new Event('focus'));
      fixture.detectChanges();
      fieldEl().dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(shellEl().classList).not.toContain('keyboard-focus');
    });
  });

  describe('faces do botao principal (US2 — SC-004)', () => {
    it('face "gravar" quando o campo esta vazio', () => {
      expect(mainButtonEl().getAttribute('aria-label')).toBe('Gravar áudio');
    });

    it('face "enviar mensagem" quando ha texto', () => {
      fixture.componentRef.setInput('value', 'ola');
      fixture.detectChanges();

      expect(mainButtonEl().getAttribute('aria-label')).toBe('Enviar mensagem');
    });

    it('face "enviar audio" no modo audio', async () => {
      await enterAudioMode();

      expect(mainButtonEl().getAttribute('aria-label')).toBe('Enviar áudio');
    });

    it('reusa o MESMO no DOM entre as tres faces — nunca recria o botao', async () => {
      const empty = mainButtonEl();

      fixture.componentRef.setInput('value', 'ola');
      fixture.detectChanges();

      expect(mainButtonEl()).toBe(empty);

      fixture.componentRef.setInput('value', '');
      fixture.detectChanges();
      await enterAudioMode();

      expect(mainButtonEl()).toBe(empty);
    });

    it('reajusta a altura do campo ao limpar o valor programaticamente apos enviar', () => {
      // Regressão de bug encontrado em verificação no navegador: limpar `value`
      // no código não dispara `input`, então o `<textarea>` continuava travado na
      // altura do texto enviado — uma caixa enorme e vazia depois do envio.
      const field = fieldEl();

      Object.defineProperty(field, 'scrollHeight', { configurable: true, value: 176 });
      fixture.componentRef.setInput('value', 'linha\nlinha\nlinha\nlinha');
      fixture.detectChanges();

      expect(field.style.height).toBe('176px');

      Object.defineProperty(field, 'scrollHeight', { configurable: true, value: 22 });
      mainButtonEl().click();
      fixture.detectChanges();

      expect(fixture.componentInstance.value()).toBe('');
      expect(field.style.height).toBe('22px');
    });

    it('emite `send` com o texto e limpa o campo', () => {
      const sent: string[] = [];

      fixture.componentInstance.send.subscribe(v => sent.push(v));
      fixture.componentRef.setInput('value', 'ola mundo');
      fixture.detectChanges();

      mainButtonEl().click();
      fixture.detectChanges();

      expect(sent).toEqual(['ola mundo']);
      expect(fixture.componentInstance.value()).toBe('');
    });

    it('nao emite `send` ao clicar com o campo vazio (entra no modo audio)', async () => {
      const sent: string[] = [];

      fixture.componentInstance.send.subscribe(v => sent.push(v));
      await enterAudioMode();

      expect(sent).toEqual([]);
      expect(fixture.componentInstance.mode()).toBe('audio');
    });

    it('Enter envia; Shift+Enter nao (FR-009)', () => {
      const sent: string[] = [];

      fixture.componentInstance.send.subscribe(v => sent.push(v));
      fixture.componentRef.setInput('value', 'ola');
      fixture.detectChanges();

      fieldEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
      fixture.detectChanges();

      expect(sent).toEqual([]);

      fieldEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();

      expect(sent).toEqual(['ola']);
    });

    it('nao faz nada ao clicar quando `disabled` (FR-016)', () => {
      const sent: string[] = [];

      fixture.componentInstance.send.subscribe(v => sent.push(v));
      fixture.componentRef.setInput('value', 'ola');
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      mainButtonEl().click();
      fixture.detectChanges();

      expect(sent).toEqual([]);
      expect(fixture.componentInstance.mode()).toBe('text');
    });

    it('nao envia por Enter quando `disabled`', () => {
      const sent: string[] = [];

      fixture.componentInstance.send.subscribe(v => sent.push(v));
      fixture.componentRef.setInput('value', 'ola');
      fixture.detectChanges();

      const field = fieldEl();

      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();

      expect(sent).toEqual([]);
    });

    it('nao envia valor composto so de espacos', () => {
      const sent: string[] = [];

      fixture.componentInstance.send.subscribe(v => sent.push(v));
      fixture.componentRef.setInput('value', '   ');
      fixture.detectChanges();

      mainButtonEl().click();
      fixture.detectChanges();

      expect(sent).toEqual([]);
    });
  });

  describe('modo audio (US3)', () => {
    it('substitui o campo pela barra de ondas', async () => {
      await enterAudioMode();

      expect(fieldEl()).toBeNull();
      expect(fixture.nativeElement.querySelector('app-input-chat-waveform')).not.toBeNull();
    });

    it('exibe o botao de cancelar dentro da barra', async () => {
      await enterAudioMode();

      expect(cancelButtonEl()?.getAttribute('aria-label')).toBe('Cancelar gravação');
    });

    it('emite `audioModeStart` quando a captura fica ativa', async () => {
      let started = 0;

      fixture.componentInstance.audioModeStart.subscribe(() => (started += 1));
      await enterAudioMode();

      expect(started).toBe(1);
    });

    it('cancelar descarta a gravacao: zero `audioSend`, libera o microfone (FR-020/SC-012)', async () => {
      const sentAudio: Blob[] = [];
      let stopped = 0;

      fixture.componentInstance.audioSend.subscribe(b => sentAudio.push(b));
      fixture.componentInstance.audioModeStop.subscribe(() => (stopped += 1));
      await enterAudioMode();

      cancelButtonEl()?.click();
      fixture.detectChanges();

      expect(sentAudio).toEqual([]);
      expect(capture.collected).not.toHaveBeenCalled();
      expect(capture.disposed).toHaveBeenCalledWith();
      expect(stopped).toBe(1);
      expect(fixture.componentInstance.mode()).toBe('text');
    });

    it('enviar emite exatamente um `audioSend` com Blob nao vazio (SC-012)', async () => {
      const sentAudio: Blob[] = [];

      fixture.componentInstance.audioSend.subscribe(b => sentAudio.push(b));
      await enterAudioMode();

      mainButtonEl().click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(sentAudio.length).toBe(1);
      expect(sentAudio[0].size).toBeGreaterThan(0);
      expect(sentAudio[0].type).toBe('audio/webm;codecs=opus');
      expect(fixture.componentInstance.mode()).toBe('text');
    });

    it('botao de enviar fica inerte antes de a captura comecar (nao emite Blob vazio)', () => {
      const sentAudio: Blob[] = [];

      fixture.componentInstance.audioSend.subscribe(b => sentAudio.push(b));
      // Entra no modo áudio sem resolver a permissão (sem `whenStable`).
      fixture.componentRef.setInput('mode', 'audio');
      fixture.detectChanges();

      mainButtonEl().click();
      fixture.detectChanges();

      expect(sentAudio).toEqual([]);
    });

    it('emite `audioModeError` e permanece no modo audio quando a permissao e negada (FR-012)', async () => {
      capture.failure = new AudioCaptureFailure('permission-denied');

      const errors: string[] = [];

      fixture.componentInstance.audioModeError.subscribe(e => errors.push(e));
      await enterAudioMode();

      expect(errors).toEqual(['permission-denied']);
      expect(fixture.componentInstance.mode()).toBe('audio');
    });

    it('classifica falha desconhecida como `unavailable`', async () => {
      capture.failure = new Error('boom') as AudioCaptureFailure;

      const errors: string[] = [];

      fixture.componentInstance.audioModeError.subscribe(e => errors.push(e));
      await enterAudioMode();

      expect(errors).toEqual(['unavailable']);
    });

    it('libera o microfone ao destruir o componente (SC-006)', async () => {
      await enterAudioMode();

      fixture.destroy();

      expect(capture.disposed).toHaveBeenCalledWith();
    });

    it('nao expoe MediaStream em nenhum output (SC-010)', () => {
      const outputs = [
        fixture.componentInstance.send,
        fixture.componentInstance.audioModeStart,
        fixture.componentInstance.audioModeStop,
        fixture.componentInstance.audioSend,
        fixture.componentInstance.audioModeError,
      ];

      expect(outputs.length).toBe(5);
      expect('audioStream' in fixture.componentInstance).toBeFalse();
      expect('audioLevel' in fixture.componentInstance).toBeFalse();
    });
  });

  describe('anuncio para leitores de tela (T050)', () => {
    function statusEl(): HTMLElement {
      return fixture.nativeElement.querySelector('.input-chat__status');
    }

    it('expoe uma regiao `aria-live="polite"`', () => {
      expect(statusEl()).not.toBeNull();
      expect(statusEl().getAttribute('aria-live')).toBe('polite');
    });

    it('nao anuncia nada no modo texto', () => {
      expect(statusEl().textContent?.trim()).toBe('');
    });

    it('anuncia a gravacao ao entrar no modo audio', async () => {
      await enterAudioMode();

      const texto = statusEl().textContent?.trim() ?? '';

      expect(texto.length).toBeGreaterThan(0);
      expect(texto.toLowerCase()).toContain('gravando');
    });

    it('para de anunciar ao voltar para o modo texto', async () => {
      await enterAudioMode();
      cancelButtonEl()?.click();
      fixture.detectChanges();

      expect(statusEl().textContent?.trim()).toBe('');
    });

    it('mantem as ondas fora da arvore de acessibilidade', async () => {
      await enterAudioMode();

      const ondas: HTMLElement = fixture.nativeElement.querySelector('.input-chat-waveform');

      expect(ondas.getAttribute('aria-hidden')).toBe('true');
    });

    it('permanece no DOM mesmo vazio — `display:none` mataria o anuncio', () => {
      const cs = getComputedStyle(statusEl());

      expect(cs.display).not.toBe('none');
      expect(cs.visibility).not.toBe('hidden');
    });
  });

  describe('crescimento e rolagem com layout real (T051 — SC-003)', () => {
    function shellHeight(): number {
      return Math.round(shellEl().getBoundingClientRect().height);
    }

    function linhas(n: number): string {
      return Array.from({ length: n }, (_, i) => `linha ${i + 1}`).join('\n');
    }

    beforeEach(() => {
      attachToDom();
    });

    it('mede 48px com o campo vazio', () => {
      expect(shellHeight()).toBe(48);
    });

    it('mantem 48px com uma unica linha', () => {
      setValue(linhas(1));

      expect(shellHeight()).toBe(48);
    });

    it('cresce de forma monotonica ate o teto', () => {
      const alturas = [1, 3, 6, 12].map(n => {
        setValue(linhas(n));

        return shellHeight();
      });

      expect(alturas[1]).toBeGreaterThan(alturas[0]);
      expect(alturas[2]).toBeGreaterThan(alturas[1]);
      expect(alturas[3]).toBeGreaterThanOrEqual(alturas[2]);
    });

    it('para exatamente no teto de 160px (default do Figma)', () => {
      setValue(linhas(12));

      expect(shellHeight()).toBe(160);
    });

    it('ativa a rolagem interna a partir do teto', () => {
      setValue(linhas(3));

      expect(shellEl().scrollHeight).toBeLessThanOrEqual(shellEl().clientHeight);

      setValue(linhas(12));

      expect(shellEl().scrollHeight).toBeGreaterThan(shellEl().clientHeight);
    });

    it('respeita um `maxHeight` customizado', () => {
      fixture.componentRef.setInput('maxHeight', 96);
      fixture.detectChanges();
      setValue(linhas(12));

      expect(shellHeight()).toBe(96);
    });

    it('volta a 48px ao esvaziar o campo', () => {
      setValue(linhas(12));

      expect(shellHeight()).toBe(160);

      setValue('');

      expect(shellHeight()).toBe(48);
    });
  });

  describe('dimensao e estabilidade do botao principal (T052 — SC-004)', () => {
    function buttonBox(): DOMRect {
      return mainButtonEl().getBoundingClientRect();
    }

    beforeEach(() => {
      attachToDom();
    });

    it('mede 48x48px na face "gravar"', () => {
      const box = buttonBox();

      expect(Math.round(box.width)).toBe(48);
      expect(Math.round(box.height)).toBe(48);
    });

    it('mede 48x48px na face "enviar mensagem"', () => {
      setValue('ola');

      const box = buttonBox();

      expect(Math.round(box.width)).toBe(48);
      expect(Math.round(box.height)).toBe(48);
    });

    it('mede 48x48px na face "enviar audio"', async () => {
      await enterAudioMode();

      const box = buttonBox();

      expect(Math.round(box.width)).toBe(48);
      expect(Math.round(box.height)).toBe(48);
    });

    it('nao desloca ao comecar e parar de digitar — zero layout shift', () => {
      const vazio = buttonBox();

      setValue('o');
      const digitando = buttonBox();

      setValue('');
      const vazioDeNovo = buttonBox();

      expect(Math.round(digitando.left)).toBe(Math.round(vazio.left));
      expect(Math.round(digitando.top)).toBe(Math.round(vazio.top));
      expect(Math.round(vazioDeNovo.left)).toBe(Math.round(vazio.left));
      expect(Math.round(vazioDeNovo.top)).toBe(Math.round(vazio.top));
    });

    it('nao desloca horizontalmente ao entrar no modo audio', async () => {
      const antes = buttonBox();

      await enterAudioMode();
      const depois = buttonBox();

      expect(Math.round(depois.left)).toBe(Math.round(antes.left));
    });

    it('permanece ancorado na base do campo enquanto ele cresce', () => {
      // `align-items: flex-end`: o botão acompanha a borda INFERIOR do campo.
      // A row inteira cresce para baixo, então o `bottom` absoluto do botão
      // muda junto — o invariante não é a coordenada, é o alinhamento com o
      // campo (nó Figma 4426:8736, onde o botão fica colado na base).
      const alinhado = (): boolean =>
        Math.round(buttonBox().bottom) === Math.round(shellEl().getBoundingClientRect().bottom);

      expect(alinhado()).toBeTrue();

      const esquerdaVazio = Math.round(buttonBox().left);

      setValue(Array.from({ length: 12 }, (_, i) => `linha ${i + 1}`).join('\n'));

      expect(alinhado()).toBeTrue();
      expect(Math.round(buttonBox().left)).toBe(esquerdaVazio);
    });
  });

  describe('ordem de tabulacao no modo audio (T053)', () => {
    it('coloca cancelar antes de enviar — acao destrutiva antes da construtiva', async () => {
      attachToDom();
      await enterAudioMode();

      const focaveis: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button:not([disabled])'));
      const rotulos = focaveis.map(b => b.getAttribute('aria-label'));

      expect(rotulos).toEqual(['Cancelar gravação', 'Enviar áudio']);
    });

    it('nao usa `tabindex` positivo — a ordem vem do DOM, nao de override', () => {
      const comTabindex: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[tabindex]'));

      comTabindex.forEach(el => {
        expect(Number(el.getAttribute('tabindex'))).toBeLessThanOrEqual(0);
      });
    });
  });

  describe('fronteiras auditaveis do componente (T054 — SC-011/SC-013)', () => {
    // As auditorias de SC-011/SC-013 eram greps manuais rodados uma única vez.
    // Aqui viram guarda permanente: se alguém introduzir conectividade,
    // persistência ou rede no componente, estes testes quebram.
    it('nao consulta o estado de conectividade (SC-011 — FR-018)', async () => {
      const onLine = spyOnProperty(navigator, 'onLine', 'get').and.returnValue(true);
      const addListener = spyOn(globalThis, 'addEventListener').and.callThrough();

      attachToDom();
      setValue('ola');
      await enterAudioMode();

      expect(onLine).not.toHaveBeenCalled();

      const eventosDeRede = addListener.calls
        .allArgs()
        .map(args => args[0])
        .filter(name => name === 'online' || name === 'offline');

      expect(eventosDeRede).toEqual([]);
    });

    it('nao persiste nada nem faz chamadas de rede (SC-013 — FR-021)', async () => {
      const setItem = spyOn(Storage.prototype, 'setItem').and.callThrough();
      const fetchSpy = spyOn(globalThis, 'fetch').and.resolveTo(new Response());

      attachToDom();
      setValue('mensagem clinica sensivel');
      mainButtonEl().click();
      fixture.detectChanges();

      await enterAudioMode();
      mainButtonEl().click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(setItem).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
