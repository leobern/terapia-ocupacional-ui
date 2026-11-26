import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

/**
 * Falha de REDE (ADR-003): o servidor não foi alcançado. Detecta pela resposta, nunca por `navigator.onLine` (mente
 * em rede ruim): status 0 (sem resposta), 502/503/504 (proxy/gateway sem o servidor) e o tempo esgotado.
 */
export function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TimeoutError) {
    return true;
  }

  return error instanceof HttpErrorResponse && [0, 502, 503, 504].includes(error.status);
}

/** Mensagem do servidor (`ErrorResponse.message`) ou um texto padrão por status. */
export function failureReason(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: unknown } | null;

    if (typeof body?.message === 'string' && body.message.trim() !== '') {
      return body.message;
    }

    return `O servidor recusou o registro (erro ${error.status}).`;
  }

  return 'Não foi possível enviar o registro.';
}
