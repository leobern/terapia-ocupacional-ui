import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import { FieldCardComponent } from '../../shared/components/field-card/field-card.component';
import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import {
  AssistantEditorController,
  type EditorAction,
} from '../../shared/services/assistant-editor-controller.service';
import { GeolocationError, GeolocationService, GeoPoint } from '../../shared/services/geolocation.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { NOW } from '../home/professional-profile';
import { HospitalSiteSource } from './hospital-site-source';
import { DEFAULT_RADIUS_METERS } from './shift.models';
import { shiftFailureMessage } from './shift.service';

export const HOSPITAL_NAME_REQUIRED_HINT = 'Informe o nome do hospital.';
export const HOSPITAL_LOCATION_REQUIRED_HINT = 'Toque em "Usar minha localização atual" estando no hospital.';
export const HOSPITAL_RADIUS_HINT = 'Informe um raio de chegada entre 50 e 5.000 metros.';
export const HOSPITAL_SAVE_FAILED_HINT =
  'Não foi possível salvar o hospital. Os dados foram mantidos; tente novamente.';
const MIN_RADIUS = 50;
const MAX_RADIUS = 5000;

const normalize = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLowerCase().trim();

/**
 * Cadastro do hospital no painel lateral conversacional (Thiago, 2026-11-25): nome, endereço, raio de chegada e a
 * localização, lida do aparelho ("Usar minha localização atual", estando no hospital). A localização e o raio é que
 * liberam o botão "Iniciar turno de trabalho". Se o nome é de um hospital já vinculado, só grava a localização dele;
 * senão cria o hospital (provisório, até haver backend).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FieldCardComponent],
  selector: 'app-hospital-editor',
  styleUrl: './hospital-editor.component.scss',
  templateUrl: './hospital-editor.component.html',
})
export class HospitalEditorComponent {
  /** Nome sugerido (o hospital em contexto). */
  readonly initialName = input('');
  /** Chamado depois de salvar, com o id do hospital gravado. */
  readonly saved = input<(hospitalId: number) => void>(() => undefined);

  protected readonly name = signal('');
  protected readonly address = signal('');
  protected readonly radius = signal(String(DEFAULT_RADIUS_METERS));
  protected readonly point = signal<GeoPoint | null>(null);
  protected readonly busy = signal(false);
  protected readonly hint = signal<string | null>(null);
  protected readonly pointText = computed(() => {
    const p = this.point();

    return p === null ? 'Ainda não informada' : `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  });

  private readonly sites = inject(HospitalSiteSource);
  private readonly context = inject(HospitalContextService);
  private readonly geolocation = inject(GeolocationService);
  private readonly assistant = inject(AiAssistantService);
  private readonly editor = inject(AssistantEditorController);
  private readonly now = inject(NOW);
  private seeded = false;

  constructor() {
    effect(() => {
      const initial = this.initialName();

      if (!this.seeded) {
        this.seeded = true;
        this.name.set(initial);
      }
    });
    effect(onCleanup => {
      const actions = computed<readonly EditorAction[]>(() => [
        { id: 'locate', label: 'Usar minha localização atual' },
        ...(this.name().trim() !== '' && this.point() !== null ? [{ id: 'save', label: 'Salvar' }] : []),
      ]);

      onCleanup(
        this.editor.attach({
          actions,
          placeholder: 'Escreva a sua mensagem',
          run: (action): void => {
            if (action === 'locate') {
              void this.locate();
            } else {
              void this.save();
            }
          },
        }),
      );
    });
  }

  protected async locate(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.hint.set(null);
    try {
      this.point.set(await this.geolocation.locate());
    } catch (failure) {
      this.hint.set(
        shiftFailureMessage({ ok: false, reason: failure instanceof GeolocationError ? failure.reason : 'error' }),
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async save(): Promise<void> {
    const name = this.name().trim();
    const point = this.point();
    const radius = Number(this.radius().trim().replace(',', '.'));

    if (this.busy()) {
      return;
    }
    if (name === '') {
      this.hint.set(HOSPITAL_NAME_REQUIRED_HINT);

      return;
    }
    if (point === null) {
      this.hint.set(HOSPITAL_LOCATION_REQUIRED_HINT);

      return;
    }
    if (!Number.isFinite(radius) || radius < MIN_RADIUS || radius > MAX_RADIUS) {
      this.hint.set(HOSPITAL_RADIUS_HINT);

      return;
    }
    const existing = this.context.hospitals().find(h => normalize(h.name) === normalize(name));
    const hospitalId = existing?.id ?? -this.now().getTime();

    this.busy.set(true);
    try {
      await this.sites.save({
        address: this.address().trim(),
        hospitalId,
        lat: point.lat,
        lng: point.lng,
        radiusMeters: Math.round(radius),
        ...(existing === undefined ? { local: true, name } : {}),
      });
      if (existing === undefined) {
        this.context.addLocal({ id: hospitalId, name });
      }
      this.saved()(hospitalId);
      this.assistant.closePanel();
    } catch {
      this.hint.set(HOSPITAL_SAVE_FAILED_HINT);
    } finally {
      this.busy.set(false);
    }
  }
}
