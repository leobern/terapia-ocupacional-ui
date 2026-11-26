import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { devTokenInterceptor } from './dev-token.interceptor';

describe('devTokenInterceptor + DevTokenService', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([devTokenInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('busca o token uma vez e o envia como Bearer nas chamadas à API', () => {
    http.get('/api/v1/a').subscribe();
    controller.expectOne('/api/v1/dev/token?email=almira@conductia.com').flush({ accessToken: 'jwt-teste' });
    const first = controller.expectOne('/api/v1/a');

    expect(first.request.headers.get('Authorization')).toBe('Bearer jwt-teste');
    first.flush({});

    http.get('/api/v1/b').subscribe();
    const second = controller.expectOne('/api/v1/b');

    expect(second.request.headers.get('Authorization')).toBe('Bearer jwt-teste');
    second.flush({});
  });

  it('não adiciona token a chamadas fora da API', () => {
    http.get('/assets/x.json').subscribe();
    const request = controller.expectOne('/assets/x.json');

    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});
  });

  it('não sobrescreve um Authorization já definido (sessão real)', () => {
    http.get('/api/v1/c', { headers: { Authorization: 'Bearer real' } }).subscribe();
    const request = controller.expectOne('/api/v1/c');

    expect(request.request.headers.get('Authorization')).toBe('Bearer real');
    request.flush({});
  });
});
