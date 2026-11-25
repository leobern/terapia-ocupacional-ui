import { Injectable } from '@angular/core';

/** Ponto na Terra, em graus decimais. */
export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

export type GeolocationFailure = 'denied' | 'timeout' | 'unavailable' | 'unsupported';

/** Falha ao ler a posição do aparelho: o motivo vira uma orientação em texto para o profissional. */
export class GeolocationError extends Error {
  constructor(readonly reason: GeolocationFailure) {
    super(`Geolocalização indisponível: ${reason}`);
  }
}

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Posição atual do aparelho pela Geolocation API do navegador (grátis, sem serviço externo). A posição nunca sai do
 * aparelho: só se compara com o raio do hospital e, se estiver dentro, o turno começa.
 */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  locate(): Promise<GeoPoint> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return Promise.reject(new GeolocationError('unsupported'));
    }

    return new Promise<GeoPoint>((resolve, reject) => {
      // Pedido pelo Thiago (turno de trabalho): a posição é lida só no clique do profissional, com o aviso do navegador.
      // eslint-disable-next-line sonarjs/no-intrusive-permissions
      navigator.geolocation.getCurrentPosition(
        position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        error => {
          if (error.code === error.PERMISSION_DENIED) {
            reject(new GeolocationError('denied'));
          } else if (error.code === error.TIMEOUT) {
            reject(new GeolocationError('timeout'));
          } else {
            reject(new GeolocationError('unavailable'));
          }
        },
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 },
      );
    });
  }
}
