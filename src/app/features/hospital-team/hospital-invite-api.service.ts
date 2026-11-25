import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { InviteLookup, InviteResult, LinkRelation } from './hospital-invite.models';
import { HospitalInvitePort } from './hospital-invite-port';

/** `ProfissionalConvite` (openapi/vinculos-api.yaml). */
interface ProfissionalConvite {
  readonly usuarioId: number;
  readonly nomeCompleto: string;
  readonly email: string;
  readonly perfilDeclarado: 'ADMIN' | 'GESTOR' | 'TERAPEUTA' | 'RECECIONISTA';
  readonly relacao: 'NENHUMA' | 'PENDENTE' | 'APROVADO';
}

/** `VinculoConvite` (somente o que a UI usa). */
interface VinculoConvite {
  readonly aproveitouSolicitacao: boolean;
}

const RELATION: Readonly<Record<ProfissionalConvite['relacao'], LinkRelation>> = {
  APROVADO: 'approved',
  NENHUMA: 'none',
  PENDENTE: 'pending',
};

const PROFILE_LABEL: Readonly<Record<ProfissionalConvite['perfilDeclarado'], string>> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  RECECIONISTA: 'Recepcionista',
  TERAPEUTA: 'Terapeuta',
};

/** O contrato usa o mesmo 404 para hospital inexistente e conta sem cadastro; só a mensagem os distingue. */
const NOT_REGISTERED = /cadastr/i;

/**
 * Convite direto contra a API real: `GET /api/v1/hospitais/{id}/profissionais` (`buscarProfissionalParaConvite`)
 * e `POST /api/v1/hospitais/{id}/convites` (`convidarProfissional`), ambos só para GESTOR.
 * Conta sem cadastro vira `not-registered`; 401/403/404 (hospital)/409 e falha de rede chegam como rejeição
 * e a tela mapeia o `status` para a mensagem.
 */
@Injectable()
export class HospitalInviteApiService extends HospitalInvitePort {
  private readonly http = inject(HttpClient);

  async lookup(hospitalId: number, email: string): Promise<InviteLookup> {
    const url = `${this.base(hospitalId)}/profissionais`;

    try {
      const dto = await firstValueFrom(
        this.http.get<ProfissionalConvite>(url, { params: new HttpParams().set('email', email.trim()) }),
      );

      return {
        kind: 'found',
        profile: {
          email: dto.email,
          nomeCompleto: dto.nomeCompleto,
          perfilDeclarado: PROFILE_LABEL[dto.perfilDeclarado] ?? dto.perfilDeclarado,
          usuarioId: dto.usuarioId,
        },
        relation: RELATION[dto.relacao] ?? 'none',
      };
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404 && NOT_REGISTERED.test(error.error?.message)) {
        return { kind: 'not-registered' };
      }
      throw error;
    }
  }

  async confirm(hospitalId: number, usuarioId: number): Promise<InviteResult> {
    if (!Number.isInteger(usuarioId)) {
      throw new Error(`Profissional inválido para a API: ${usuarioId}`);
    }
    const link = await firstValueFrom(
      this.http.post<VinculoConvite>(`${this.base(hospitalId)}/convites`, { perfilConfirmado: true, usuarioId }),
    );

    return { aproveitouSolicitacao: link.aproveitouSolicitacao };
  }

  private base(hospitalId: number): string {
    if (!Number.isInteger(hospitalId)) {
      throw new Error(`Hospital inválido para a API: ${hospitalId}`);
    }

    return `${environment.apiBaseUrl}/v1/hospitais/${hospitalId}`;
  }
}
