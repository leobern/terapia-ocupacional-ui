import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

// TODO: rota provisória (specs/004-notificacoes research.md §8) — a feature
// "Detalhe do Paciente" ainda não foi especificada/implementada. Este stub
// só existe para que o clique no card de notificação (FR-006) tenha um
// destino real de navegação em vez de um 404 não tratado. Substituir por
// inteiro quando aquela feature existir — nenhum consumidor depende do
// conteúdo deste componente além de confirmar que a navegação chegou aqui.
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-patient-detail-placeholder',
  template: `<p style="padding: 24px">Detalhe do paciente {{ patientId() }} — tela ainda não especificada.</p>`,
})
export class PatientDetailPlaceholderComponent {
  protected readonly patientId = toSignal(inject(ActivatedRoute).paramMap.pipe(map(params => params.get('id'))), {
    initialValue: null,
  });
}
