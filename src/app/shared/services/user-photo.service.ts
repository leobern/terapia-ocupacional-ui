import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

/** Tamanho máximo aceito pelo backend (2 MB). */
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Foto de perfil das pessoas. O `<img>` não envia o token, então a imagem é baixada pelo HttpClient (com a sessão)
 * e vira uma URL local em cache. `version` muda ao trocar ou remover a minha foto, para os avatares recarregarem.
 */
@Injectable({ providedIn: 'root' })
export class UserPhotoService {
  /** Sobe a cada troca/remoção da própria foto. */
  readonly version = signal(0);

  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/v1/perfil`;
  private readonly cache = new Map<string, Promise<string | null>>();

  /** URL local da foto ou `null` se a pessoa não tem foto. */
  url(userId: number): Promise<string | null> {
    const key = `${userId}:${this.version()}`;
    let found = this.cache.get(key);

    if (!found) {
      found = firstValueFrom(this.http.get(`${this.base}/${userId}/foto`, { responseType: 'blob' })).then(
        blob => URL.createObjectURL(blob),
        () => null,
      );
      this.cache.set(key, found);
    }

    return found;
  }

  /** Valida tipo e tamanho antes de enviar; devolve a mensagem de erro ou `null`. */
  validate(file: Blob): string | null {
    if (!PHOTO_TYPES.includes(file.type)) {
      return 'A foto deve ser JPEG, PNG ou WebP.';
    }

    return file.size > PHOTO_MAX_BYTES ? 'A foto deve ter até 2 MB.' : null;
  }

  async upload(file: Blob): Promise<void> {
    await firstValueFrom(this.http.put(`${this.base}/me/foto`, file, { headers: { 'Content-Type': file.type } }));
    this.version.update(v => v + 1);
  }

  async remove(): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/me/foto`));
    this.version.update(v => v + 1);
  }
}
