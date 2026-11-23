/**
 * Porta de transcrição de áudio em texto (campos de resposta e de cadastro por voz). O consumidor grava com o
 * `app-input-chat`, entrega o `Blob` aqui e recebe o TEXTO para o usuário revisar antes de enviar — nunca envia
 * o áudio direto. Falha (`reject`) = sem IA/sem internet: o usuário segue digitando (cadastro manual sempre existe).
 */
export abstract class AudioTranscriber {
  abstract transcribe(audio: Blob): Promise<string>;
}
