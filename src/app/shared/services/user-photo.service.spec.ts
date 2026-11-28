import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PHOTO_MAX_BYTES, UserPhotoService } from './user-photo.service';

describe('UserPhotoService', () => {
  let service: UserPhotoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UserPhotoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('baixa a foto uma vez e guarda em cache por versão', async () => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:foto');
    const first = service.url(5);
    const second = service.url(5);

    http.expectOne('/api/v1/perfil/5/foto').flush(new Blob(['x'], { type: 'image/png' }));

    expect(await first).toBe('blob:foto');
    expect(await second).toBe('blob:foto');
  });

  it('sem foto (404) devolve null', async () => {
    const promise = service.url(9);

    http.expectOne('/api/v1/perfil/9/foto').flush(null, { status: 404, statusText: 'Not Found' });

    expect(await promise).toBeNull();
  });

  it('valida tipo e tamanho', () => {
    expect(service.validate(new Blob(['x'], { type: 'image/gif' }))).toContain('JPEG');
    expect(service.validate(new Blob([new Uint8Array(PHOTO_MAX_BYTES + 1)], { type: 'image/png' }))).toContain('2 MB');
    expect(service.validate(new Blob(['x'], { type: 'image/webp' }))).toBeNull();
  });

  it('envia a foto com o tipo e sobe a versão', async () => {
    const file = new Blob(['x'], { type: 'image/png' });
    const promise = service.upload(file);
    const req = http.expectOne('/api/v1/perfil/me/foto');

    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Content-Type')).toBe('image/png');
    req.flush(null);
    await promise;

    expect(service.version()).toBe(1);
  });

  it('remove a foto e sobe a versão', async () => {
    const promise = service.remove();

    const req = http.expectOne('/api/v1/perfil/me/foto');

    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;

    expect(service.version()).toBe(1);
  });
});
