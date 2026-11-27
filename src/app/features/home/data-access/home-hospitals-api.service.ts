import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Role, SessionRoleReader } from '../../../shared/auth/session-role';
import { LinkedHospital, LinkedHospitalsReader } from '../linked-hospitals';
import { HomeApiService } from './home-api.service';

/**
 * Hospitais com vínculo aprovado do profissional via API real (`GET /api/v1/home/hospitals`,
 * openapi/home-api.yaml). O gestor não tem vínculo e a rota da Home o recusa (403): para ele a lista vem de
 * `GET /api/v1/hospitais`. Erros (401 etc.) chegam como `HttpErrorResponse` rejeitado.
 */
@Injectable()
export class HomeHospitalsApiService extends LinkedHospitalsReader {
  private readonly api = inject(HomeApiService);

  private readonly session = inject(SessionRoleReader, { optional: true });

  async read(): Promise<readonly LinkedHospital[]> {
    if (this.session?.read() === Role.GESTOR) {
      const managed = await firstValueFrom(this.api.getManagedHospitals());

      return managed.map(({ id, nome }) => ({ id, name: nome }));
    }
    const hospitals = await firstValueFrom(this.api.getHospitals());

    return hospitals.map(({ id, name }) => ({ id, name }));
  }
}
