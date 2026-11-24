import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PatientsApiService } from './patients-api.service';

describe('PatientsApiService', () => {
  it('envia a verificação de duplicidade por POST e devolve o resultado', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const result = { candidates: [], duplicate: false };
    let received: unknown;

    TestBed.inject(PatientsApiService)
      .checkDuplicate({ birthDate: '1980-05-05', fullName: 'Francisco das Chagas', hospitalId: 3 })
      .subscribe(r => (received = r));
    const req = http.expectOne(r => r.url.endsWith('/v1/pacientes/duplicidade'));

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      birthDate: '1980-05-05',
      fullName: 'Francisco das Chagas',
      hospitalId: 3,
    });
    req.flush(result);
    http.verify();

    expect(received).toEqual(result);
  });
});
