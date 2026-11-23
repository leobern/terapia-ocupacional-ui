import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { LinkedHospital, LinkedHospitalsReader } from '../linked-hospitals';
import { HomeApiService } from './home-api.service';

/**
 * Hospitais com vínculo aprovado do profissional via API real (`GET /api/v1/home/hospitals`,
 * openapi/home-api.yaml). Erros (401 etc.) chegam como `HttpErrorResponse` rejeitado.
 */
@Injectable()
export class HomeHospitalsApiService extends LinkedHospitalsReader {
  private readonly api = inject(HomeApiService);

  async read(): Promise<readonly LinkedHospital[]> {
    const hospitals = await firstValueFrom(this.api.getHospitals());

    return hospitals.map(({ id, name }) => ({ id, name }));
  }
}
