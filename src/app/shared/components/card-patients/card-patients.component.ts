import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { GraphMetaComponent } from '../graph-meta/graph-meta.component';

/**
 * Card de resumo diário de carga de trabalho por profissional (DS-component-card-patients).
 * Composicional: renderiza `app-graph-meta` (médias calórica/protéica do dia) e
 * `app-icon-button` (CTA) sem reimplementar nenhum dos dois
 * (specs/ds/DS-component-card-patients/research.md §1).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GraphMetaComponent, PhIconComponent],
  selector: 'app-card-patients',
  styleUrl: './card-patients.component.scss',
  templateUrl: './card-patients.component.html',
})
export class CardPatientsComponent {
  // Sem prop `size`: só existe a variação `mobile` (nó Figma `4041:1472`), então
  // uma união de um membro só é ruído de API — o consumidor não tem escolha a
  // fazer. Quando a variante `desktop` for desenhada, a prop volta com dois
  // valores reais.
  readonly patientCount = input.required<number>();
  readonly averageCaloricPercentage = input.required<number>();
  readonly averageProteinPercentage = input.required<number>();
  readonly actionAriaLabel = input.required<string>();
  readonly actionDisabled = input<boolean>(false);

  // Área de toque estendida (2026-07-25, pedido do usuário): o card inteiro
  // é clicável, não só o `icon-button` interno — melhora usabilidade de
  // toque em mobile. Emitido a partir de um único `(click)` no `<article>`
  // raiz (o clique no `icon-button` interno já borbulha até lá nativamente,
  // então não há binding duplicado nele). Deliberadamente NÃO torna o
  // `<article>` focável/`role="button"` — o único controle acessível por
  // teclado continua sendo o `icon-button` interno, evitando o
  // anti-padrão de dois elementos interativos aninhados (um focável dentro
  // do outro) que confundiria navegação por teclado/leitor de tela.
  readonly cardClick = output();

  protected readonly isZero = computed(() => this.patientCount() === 0);

  // Figma v2/CardPatients: "N pacientes" / "aguardando atendimento hoje"; zerado →
  // título "Todos os pacientes foram atendidos" e subtítulo "metas médias do dia".
  // FR-001: contagem > 0 → título "N Pacientes"; zerado → título oculto (só a
  // fonte do título some, o subtitle assume a mensagem — ver `subtitle`
  // abaixo, ajuste pedido pelo usuário em 2026-07-25).
  protected readonly title = computed(() =>
    this.isZero() ? 'Todos os pacientes foram atendidos' : `${this.patientCount()} pacientes`,
  );

  // Rótulo fixo do Figma (nó 4041:1472, "Aguardando atendimento") no estado
  // default. FR-002: no estado zerado, o mesmo slot de subtítulo passa a
  // exibir a mensagem de "todos atendidos" (em vez do título, que fica
  // oculto) — decisão do usuário em 2026-07-25, substitui o comportamento
  // anterior (mensagem no título, subtítulo oculto).
  protected readonly subtitle = computed(() => 'aguardando atendimento hoje');

  // FR-004: CTA desabilitado quando não há pacientes OU quando o consumidor
  // desabilita explicitamente a ação.
  protected readonly ctaDisabled = computed(() => this.isZero() || this.actionDisabled());

  protected onCardClick(): void {
    if (!this.ctaDisabled()) {
      this.cardClick.emit();
    }
  }
}
