import { HttpErrorResponse } from '@angular/common/http';

/** Mensagem de erro da API (401/403/404/422 têm texto próprio); o resto usa o `fallback`. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  switch (error instanceof HttpErrorResponse ? error.status : 0) {
    case 401:
      return 'Sua sessão expirou. Entre novamente para continuar.';
    case 403:
      return 'Você não é participante desta notificação.';
    case 404:
      return 'Esta notificação não foi encontrada.';
    case 422:
      return 'Não foi possível processar a resposta. Revise o texto e tente novamente.';
    default:
      return fallback;
  }
}
