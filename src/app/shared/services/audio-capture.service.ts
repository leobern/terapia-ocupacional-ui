import { Injectable } from '@angular/core';

/** Motivos de falha expostos ao consumidor via `audioModeError`. */
export type AudioCaptureErrorReason = 'permission-denied' | 'unavailable';

/** Falha de captura, com o motivo já classificado para o componente. */
export class AudioCaptureFailure extends Error {
  constructor(readonly reason: AudioCaptureErrorReason) {
    super(`audio capture failed: ${reason}`);
    this.name = 'AudioCaptureFailure';
  }
}

/**
 * Sessão de captura ativa. O componente nunca toca em `MediaStream`,
 * `AudioContext` ou `MediaRecorder` diretamente — só nestes três métodos.
 */
export interface AudioCaptureHandle {
  /** Preenche `out` com as amplitudes normalizadas (0..1) do quadro atual. */
  readFrame(out: Float32Array): void;
  /** Encerra a gravação e resolve com o áudio capturado. Libera tudo depois. */
  stopAndCollect(): Promise<Blob>;
  /** Descarta a gravação e libera tudo. Idempotente. */
  dispose(): void;
}

/** 6 grupos × 5 barras — geometria medida no SVG do Figma (research.md §3). */
export const WAVEFORM_BAR_COUNT = 30;

/** 3 bins por barra ⇒ 90 dos 128 bins (faixa da voz, ~0–7,8 kHz). */
const BINS_PER_BAND = 3;

/**
 * Opus em WebM é o que Whisper aceita e o que os navegadores evergreen
 * produzem; se nenhum for suportado, deixamos o navegador escolher em vez de
 * forçar um mimeType inválido (que faria o `MediaRecorder` lançar).
 */
const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

function createHandle(stream: MediaStream): AudioCaptureHandle {
  const context = new AudioContext();
  const analyser = context.createAnalyser();

  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.6;
  context.createMediaStreamSource(stream).connect(analyser);

  // Buffer alocado uma única vez: o loop de animação roda a 30fps e não pode
  // gerar lixo por quadro.
  const bins = new Uint8Array(analyser.frequencyBinCount);
  const chunks: Blob[] = [];
  const mimeType = PREFERRED_MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  recorder.addEventListener('dataavailable', event => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });
  recorder.start();

  let released = false;

  // Ordem obrigatória (contracts §5): o recorder precisa parar ANTES de as
  // tracks morrerem, senão o último chunk se perde e o Blob sai truncado.
  function release(): void {
    if (released) {
      return;
    }
    released = true;

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    void context.close();
    stream.getTracks().forEach(track => track.stop());
  }

  return {
    dispose: release,

    readFrame(out: Float32Array): void {
      analyser.getByteFrequencyData(bins);

      for (let bar = 0; bar < out.length; bar += 1) {
        let sum = 0;

        // Sem guarda de índice: 30 barras × 3 bins = 90, sempre dentro dos 128
        // bins de `fftSize: 256`. Uma guarda aqui seria ramo morto.
        for (let bin = 0; bin < BINS_PER_BAND; bin += 1) {
          sum += bins[bar * BINS_PER_BAND + bin];
        }

        out[bar] = sum / BINS_PER_BAND / 255;
      }
    },

    stopAndCollect(): Promise<Blob> {
      return new Promise<Blob>(resolve => {
        const finish = (): void => {
          const blob = new Blob(chunks, { type: mimeType ?? recorder.mimeType });

          release();
          resolve(blob);
        };

        if (recorder.state === 'inactive') {
          finish();

          return;
        }

        recorder.addEventListener('stop', finish, { once: true });
        recorder.stop();
      });
    },
  };
}

/**
 * Fronteira única com as APIs de áudio da plataforma (`getUserMedia`,
 * `AudioContext`/`AnalyserNode`, `MediaRecorder`).
 *
 * Existe como serviço injetável para que os testes do componente e das ondas
 * substituam a captura por um fake determinístico — sem isso, verificar a
 * fórmula de amplitude, o par cancelar/enviar e o cleanup de microfone
 * dependeria de hardware real (ver research.md §5 e §9).
 */
@Injectable({ providedIn: 'root' })
export class AudioCaptureService {
  async start(): Promise<AudioCaptureHandle> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new AudioCaptureFailure('unavailable');
    }

    let stream: MediaStream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new AudioCaptureFailure('permission-denied');
    }

    return createHandle(stream);
  }
}
