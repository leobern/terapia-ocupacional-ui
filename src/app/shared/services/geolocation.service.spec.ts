import { TestBed } from '@angular/core/testing';

import { distanceMeters, GeolocationError, GeolocationService } from './geolocation.service';

describe('distanceMeters', () => {
  it('é zero para o mesmo ponto', () => {
    expect(distanceMeters({ lat: -23.55, lng: -46.63 }, { lat: -23.55, lng: -46.63 })).toBe(0);
  });

  it('mede cerca de 111 km por grau de latitude', () => {
    const meters = distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });

    expect(meters).toBeGreaterThan(110_000);
    expect(meters).toBeLessThan(112_000);
  });

  it('mede poucas centenas de metros entre pontos vizinhos', () => {
    const meters = distanceMeters({ lat: -23.55, lng: -46.63 }, { lat: -23.5527, lng: -46.63 });

    expect(meters).toBeGreaterThan(290);
    expect(meters).toBeLessThan(310);
  });
});

describe('GeolocationService', () => {
  let service: GeolocationService;

  type Success = (position: GeolocationPosition) => void;
  type Failure = (error: GeolocationPositionError) => void;

  const fake = (run: (ok: Success, fail: Failure) => void): void => {
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((ok, fail) => run(ok, fail as Failure));
  };
  const failure = (code: number): GeolocationPositionError =>
    ({ code, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as GeolocationPositionError;

  beforeEach(() => {
    service = TestBed.inject(GeolocationService);
  });

  it('devolve a posição lida', async () => {
    fake(ok => ok({ coords: { latitude: -23.5, longitude: -46.6 } } as GeolocationPosition));

    expect(await service.locate()).toEqual({ lat: -23.5, lng: -46.6 });
  });

  for (const [code, reason] of [
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ] as const) {
    it(`falha com o motivo "${reason}"`, async () => {
      fake((_, fail) => fail(failure(code)));

      await expectAsync(service.locate()).toBeRejectedWith(jasmine.objectContaining({ reason }));
    });
  }

  it('sem suporte do navegador, falha com "unsupported"', async () => {
    const error = new GeolocationError('unsupported');

    expect(error.reason).toBe('unsupported');
    expect(error.message).toContain('unsupported');
  });
});
