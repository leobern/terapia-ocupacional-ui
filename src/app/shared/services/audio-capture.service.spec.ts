import { TestBed } from '@angular/core/testing';

import { AudioCaptureFailure, AudioCaptureService, WAVEFORM_BAR_COUNT } from './audio-capture.service';

describe('AudioCaptureService', () => {
  let service: AudioCaptureService;

  /** Ordem observada das chamadas de liberação — o cerne do contrato §5. */
  let releaseOrder: string[];
  let recorderListeners: Record<string, (() => void)[]>;
  let tracks: { readyState: string; stop: () => void }[];

  function installFakes(options: { recorderState?: string } = {}): void {
    releaseOrder = [];
    recorderListeners = {};
    tracks = [
      {
        readyState: 'live',
        stop(): void {
          this.readyState = 'ended';
          releaseOrder.push('track.stop');
        },
      },
    ];

    const stream = { getTracks: () => tracks } as unknown as MediaStream;

    (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = class {
      state = options.recorderState ?? 'recording';
      mimeType = 'audio/webm;codecs=opus';

      static readonly isTypeSupported = (type: string): boolean => type === 'audio/webm;codecs=opus';

      addEventListener(name: string, handler: () => void): void {
        recorderListeners[name] ??= [];
        recorderListeners[name].push(handler);
      }

      start(): void {
        releaseOrder.push('recorder.start');
      }

      stop(): void {
        this.state = 'inactive';
        releaseOrder.push('recorder.stop');
        recorderListeners['stop']?.forEach(h => h());
      }
    };

    (globalThis as unknown as { AudioContext: unknown }).AudioContext = class {
      close(): Promise<void> {
        releaseOrder.push('context.close');

        return Promise.resolve();
      }

      createAnalyser(): unknown {
        return {
          fftSize: 0,
          frequencyBinCount: 128,
          getByteFrequencyData: (out: Uint8Array) => out.fill(255),
          smoothingTimeConstant: 0,
        };
      }

      createMediaStreamSource(): { connect: () => void } {
        return { connect: () => undefined };
      }
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: (): Promise<MediaStream> => Promise.resolve(stream) },
    });
  }

  beforeEach(() => {
    service = TestBed.inject(AudioCaptureService);
  });

  it('libera os recursos na ordem obrigatoria: recorder -> context -> tracks', async () => {
    installFakes();

    const handle = await service.start();

    handle.dispose();

    expect(releaseOrder).toEqual(['recorder.start', 'recorder.stop', 'context.close', 'track.stop']);
  });

  it('encerra todas as tracks — nenhuma permanece "live" (SC-006)', async () => {
    installFakes();

    const handle = await service.start();

    handle.dispose();

    expect(tracks.every(t => t.readyState === 'ended')).toBeTrue();
  });

  it('dispose() e idempotente — cancelar e ngOnDestroy podem chamar em sequencia', async () => {
    installFakes();

    const handle = await service.start();

    handle.dispose();
    handle.dispose();
    handle.dispose();

    expect(releaseOrder.filter(step => step === 'context.close').length).toBe(1);
  });

  it('stopAndCollect resolve com um Blob e libera tudo', async () => {
    installFakes();

    const handle = await service.start();
    const blob = await handle.stopAndCollect();

    expect(blob.type).toBe('audio/webm;codecs=opus');
    expect(releaseOrder).toContain('context.close');
    expect(tracks.every(t => t.readyState === 'ended')).toBeTrue();
  });

  it('stopAndCollect funciona mesmo se o recorder ja estiver inativo', async () => {
    installFakes({ recorderState: 'inactive' });

    const handle = await service.start();
    const blob = await handle.stopAndCollect();

    expect(blob).toBeInstanceOf(Blob);
  });

  it('readFrame normaliza os bins para 0..1 em 30 bandas', async () => {
    installFakes();

    const handle = await service.start();
    const out = new Float32Array(WAVEFORM_BAR_COUNT);

    handle.readFrame(out);

    expect(out.length).toBe(30);
    out.forEach(v => expect(v).toBeCloseTo(1, 5));
  });

  it('coleta os chunks emitidos pelo recorder no Blob final', async () => {
    installFakes();

    const handle = await service.start();

    recorderListeners['dataavailable']?.forEach(h =>
      (h as unknown as (e: { data: Blob }) => void)({ data: new Blob(['abc']) }),
    );

    const blob = await handle.stopAndCollect();

    expect(blob.size).toBe(3);
  });

  it('ignora chunks vazios', async () => {
    installFakes();

    const handle = await service.start();

    recorderListeners['dataavailable']?.forEach(h =>
      (h as unknown as (e: { data: Blob }) => void)({ data: new Blob([]) }),
    );

    const blob = await handle.stopAndCollect();

    expect(blob.size).toBe(0);
  });

  it('deixa o navegador escolher o formato quando nenhum preferido e suportado', async () => {
    installFakes();
    (globalThis as unknown as { MediaRecorder: { isTypeSupported: () => boolean } }).MediaRecorder.isTypeSupported =
      (): boolean => false;

    const handle = await service.start();
    const blob = await handle.stopAndCollect();

    // Sem mimeType forçado, o tipo vem do próprio recorder — nunca de um
    // formato inválido, que faria o `MediaRecorder` lançar na construção.
    expect(blob.type).toBe('audio/webm;codecs=opus');
  });

  it('classifica ausencia de API como "unavailable"', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });

    await expectAsync(service.start()).toBeRejectedWith(new AudioCaptureFailure('unavailable'));
  });

  it('classifica recusa do usuario como "permission-denied"', async () => {
    installFakes();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: (): Promise<never> => Promise.reject(new Error('NotAllowedError')) },
    });

    await expectAsync(service.start()).toBeRejectedWith(new AudioCaptureFailure('permission-denied'));
  });
});
