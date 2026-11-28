import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import {
  AdminHospital,
  Interaction,
  InviteRequest,
  InviteResult,
  PersonDetail,
  Profile,
  ProfileEdit,
  TeamMember,
  UserRole,
} from './administration.models';

export interface TeamFilters {
  readonly busca?: string;
  readonly hospitalId?: number;
  readonly papel?: string;
  readonly situacao?: string;
}

/** Cliente HTTP da Administração (equipe, vínculos, hospitais, convites) e do perfil do próprio usuário. */
@Injectable({ providedIn: 'root' })
export class AdministrationApi {
  private readonly http = inject(HttpClient);
  private readonly admin = `${environment.apiBaseUrl}/v1/admin`;
  private readonly profile = `${environment.apiBaseUrl}/v1/perfil`;

  listTeam(filters: TeamFilters = {}): Promise<TeamMember[]> {
    const params: Record<string, string> = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') {
        params[key] = String(value);
      }
    }

    return firstValueFrom(this.http.get<TeamMember[]>(`${this.admin}/equipe`, { params }));
  }

  personDetail(userId: number): Promise<PersonDetail> {
    return firstValueFrom(this.http.get<PersonDetail>(`${this.admin}/equipe/${userId}`));
  }

  personInteractions(userId: number): Promise<Interaction[]> {
    return firstValueFrom(this.http.get<Interaction[]>(`${this.admin}/equipe/${userId}/interacoes`));
  }

  link(userId: number, hospitalId: number, hospitalRole: 'PROFISSIONAL' | 'GESTOR'): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`${this.admin}/equipe/${userId}/vinculos`, { hospitalId, papelHospital: hospitalRole }),
    );
  }

  unlink(userId: number, hospitalId: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.admin}/equipe/${userId}/vinculos/${hospitalId}`));
  }

  deactivate(userId: number): Promise<unknown> {
    return firstValueFrom(this.http.patch(`${this.admin}/equipe/${userId}/desativar`, {}));
  }

  reactivate(userId: number): Promise<unknown> {
    return firstValueFrom(this.http.patch(`${this.admin}/equipe/${userId}/reativar`, {}));
  }

  changeRole(userId: number, papel: UserRole): Promise<unknown> {
    return firstValueFrom(this.http.patch(`${this.admin}/equipe/${userId}/papel`, { papel }));
  }

  invite(request: InviteRequest): Promise<InviteResult> {
    return firstValueFrom(this.http.post<InviteResult>(`${this.admin}/convites`, request));
  }

  resendInvite(inviteId: number): Promise<InviteResult> {
    return firstValueFrom(this.http.post<InviteResult>(`${this.admin}/convites/${inviteId}/reenviar`, null));
  }

  cancelInvite(inviteId: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.admin}/convites/${inviteId}`));
  }

  listHospitals(): Promise<AdminHospital[]> {
    return firstValueFrom(this.http.get<AdminHospital[]>(`${this.admin}/hospitais`));
  }

  createHospital(nome: string, endereco: string): Promise<AdminHospital> {
    return firstValueFrom(this.http.post<AdminHospital>(`${this.admin}/hospitais`, { endereco, nome }));
  }

  updateHospital(id: number, nome: string, endereco: string): Promise<AdminHospital> {
    return firstValueFrom(this.http.put<AdminHospital>(`${this.admin}/hospitais/${id}`, { endereco, nome }));
  }

  setHospitalActive(id: number, active: boolean): Promise<AdminHospital> {
    return firstValueFrom(
      this.http.patch<AdminHospital>(`${this.admin}/hospitais/${id}/${active ? 'reativar' : 'inativar'}`, {}),
    );
  }

  myProfile(): Promise<Profile> {
    return firstValueFrom(this.http.get<Profile>(`${this.profile}/me`));
  }

  saveProfile(edit: ProfileEdit): Promise<Profile> {
    return firstValueFrom(this.http.put<Profile>(`${this.profile}/me`, edit));
  }

  myInteractions(): Promise<Interaction[]> {
    return firstValueFrom(this.http.get<Interaction[]>(`${this.profile}/me/interacoes`));
  }
}
