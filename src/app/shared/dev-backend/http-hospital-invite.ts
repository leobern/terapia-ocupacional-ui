import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { InviteLookup, InviteResult, LinkRelation } from '../../features/hospital-team/hospital-invite.models';
import { HospitalInvitePort } from '../../features/hospital-team/hospital-invite-port';

/** Resposta de `GET /api/v1/hospitais/{id}/profissionais` (backend, ProfissionalConviteResponse). */
interface ProfessionalDto {
  readonly usuarioId: number;
  readonly nomeCompleto: string;
  readonly email: string;
  readonly perfilDeclarado: string;
  readonly relacao: 'NENHUMA' | 'PENDENTE' | 'APROVADO';
}

const RELATION: Record<ProfessionalDto['relacao'], LinkRelation> = {
  APROVADO: 'approved',
  NENHUMA: 'none',
  PENDENTE: 'pending',
};

/** O cadastro ainda não tem especialidade: o perfil declarado é o papel da conta. */
const PROFILE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  RECECIONISTA: 'Rececionista',
  TERAPEUTA: 'Terapeuta',
};

/** Convite direto contra a API real do EP-009 (backend). Ligado só em `devBackend` até o login existir. */
@Injectable()
export class HttpHospitalInvite extends HospitalInvitePort {
  private readonly http = inject(HttpClient);

  async lookup(hospitalId: number, email: string): Promise<InviteLookup> {
    try {
      const dto = await this.find(hospitalId, email);

      return {
        kind: 'found',
        profile: {
          email: dto.email,
          name: dto.nomeCompleto,
          specialty: PROFILE_LABEL[dto.perfilDeclarado] ?? dto.perfilDeclarado,
        },
        relation: RELATION[dto.relacao],
      };
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404 && /cadastr/i.test(String(error.error?.message))) {
        return { kind: 'not-registered' };
      }
      throw error;
    }
  }

  async confirm(hospitalId: number, email: string): Promise<InviteResult> {
    const found = await this.find(hospitalId, email);
    const link = await firstValueFrom(
      this.http.post<{ aproveitouSolicitacao: boolean }>(`${this.base(hospitalId)}/convites`, {
        perfilConfirmado: true,
        usuarioId: found.usuarioId,
      }),
    );

    return { approvedRequest: link.aproveitouSolicitacao };
  }

  private find(hospitalId: number, email: string): Promise<ProfessionalDto> {
    return firstValueFrom(
      this.http.get<ProfessionalDto>(`${this.base(hospitalId)}/profissionais`, {
        params: new HttpParams().set('email', email.trim()),
      }),
    );
  }

  private base(hospitalId: number): string {
    if (!Number.isInteger(hospitalId)) {
      throw new Error(`Hospital inválido para a API: ${hospitalId}`);
    }

    return `${environment.apiBaseUrl}/v1/hospitais/${hospitalId}`;
  }
}
