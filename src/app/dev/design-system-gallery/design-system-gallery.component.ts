import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { BackgroundMeshComponent } from '../../shared/components/background-mesh/background-mesh.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import {
  BottomSheetComponent,
  type BottomSheetSnap,
  type ChatShortcut,
} from '../../shared/components/bottom-sheet/bottom-sheet.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { CardNotifyComponent } from '../../shared/components/card-notify/card-notify.component';
import { CardPatientsComponent } from '../../shared/components/card-patients/card-patients.component';
import { GraphMetaComponent } from '../../shared/components/graph-meta/graph-meta.component';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { InputChatComponent } from '../../shared/components/input-chat/input-chat.component';
import { InputSelectComponent } from '../../shared/components/input-select/input-select.component';
import { TagComponent } from '../../shared/components/tag/tag.component';

/**
 * Página de desenvolvimento — não faz parte do produto. Renderiza os
 * componentes do design system (`specs/ds/DS-*`) em todas as combinações
 * relevantes, para testar visualmente e por teclado antes de uma feature
 * consumi-los. Cresce junto com novos componentes (`input-select` etc.) —
 * uma seção por componente.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    BackgroundMeshComponent,
    BadgeComponent,
    BottomSheetComponent,
    ButtonComponent,
    CardNotifyComponent,
    CardPatientsComponent,
    GraphMetaComponent,
    IconButtonComponent,
    InputChatComponent,
    InputSelectComponent,
    TagComponent,
  ],
  selector: 'app-design-system-gallery',
  styleUrl: './design-system-gallery.component.scss',
  templateUrl: './design-system-gallery.component.html',
})
export class DesignSystemGalleryComponent {
  // Signals com estado real (não apenas valores estáticos) para TODAS as
  // instâncias de input-select responderem de verdade a digitação/clear
  // durante teste manual — um componente de apresentação puro só reage a
  // `valueChange` se algo realmente escutar e atualizar o valor de volta.
  // Sem isso, clicar no clear (ou digitar) em qualquer instância "estática"
  // da galeria não tem efeito visível nenhum — o componente já emite
  // corretamente, só não há ninguém ouvindo.
  protected readonly demoTextFilledValue = signal('thiago.angelito@gmail.com');
  protected readonly demoSelectFilledValue = signal('thiago.angelito@gmail.com');
  protected readonly demoTruncatedValue = signal(
    'um.email.bem.mais.longo.do.que.o.espaco.disponivel.para.caber@example.com',
  );
  protected readonly demoEmailFocusValue = signal('thiago.angelito@gmail.com');
  protected readonly demoSelectFocusValue = signal('');

  // Demonstra a área de toque estendida do card-patients — o card zerado
  // não deve atualizar isto ao clicar (CTA desabilitado).
  protected readonly cardPatientsLastClick = signal('nenhum clique ainda');

  // Demonstra a área de toque estendida do card-notify — a instância com
  // actionDisabled=true não deve atualizar isto ao clicar.
  protected readonly cardNotifyLastClick = signal('nenhum clique ainda');

  // Mesma lição do input-select: um componente de apresentação só reage de
  // verdade se alguém escutar o output e devolver o valor. Sem isto, o teste
  // manual de crescimento/rolagem/troca de face não funcionaria e o bug ficaria
  // mascarado pela demo, não pelo componente.
  protected readonly chatValue = signal('');
  protected readonly chatDisabledValue = signal('Mensagem em campo desabilitado');
  protected readonly chatLastEvent = signal('nenhum evento ainda');

  // --- bottom-sheet -----------------------------------------------------------
  //
  // O sheet é CONTROLADO: `open` e `snap` vivem aqui, e o componente só emite
  // intenções (contracts/bottom-sheet-api.md § Obrigações do consumidor). Gravar
  // `(snapChange)` não é opcional — sem isso o encaixe não persiste e a
  // reabertura em `default` (FR-025) não acontece.
  protected readonly sheetOpen = signal(false);
  protected readonly sheetSnap = signal<BottomSheetSnap>('default');
  protected readonly sheetLastEvent = signal('nenhum evento ainda');

  // Os dois atalhos desenhados no Figma (`4412:5943`/`4412:5944`). São conteúdo
  // de exemplo, contextuais por conversa — o componente não conhece atalho fixo
  // nenhum (spec.md § Diretrizes de Uso).
  protected readonly sheetShortcuts = signal<ChatShortcut[]>([
    { id: 'pendencias', label: 'Quais são minhas pendências de hoje?' },
    { id: 'fora-da-meta', label: 'Pacientes fora da meta nutricional' },
  ]);

  protected readonly sheetChatValue = signal('');

  protected onCardPatientsClick(variant: string): void {
    this.cardPatientsLastClick.set(`card-patients (${variant}) — ${new Date().toLocaleTimeString()}`);
  }

  protected onCardNotifyClick(variant: string): void {
    this.cardNotifyLastClick.set(`card-notify (${variant}) — ${new Date().toLocaleTimeString()}`);
  }

  protected onChatSend(message: string): void {
    this.chatLastEvent.set(`send: "${message}"`);
  }

  protected onChatAudioEvent(event: string): void {
    this.chatLastEvent.set(`${event} — ${new Date().toLocaleTimeString()}`);
  }

  protected onChatAudioSend(blob: Blob): void {
    this.chatLastEvent.set(`audioSend: ${blob.size} bytes, type="${blob.type}"`);
  }

  protected onSheetClosed(): void {
    this.sheetOpen.set(false);
    this.sheetLastEvent.set(`closed — ${new Date().toLocaleTimeString()}`);
  }

  protected onSheetSnapChange(snap: BottomSheetSnap): void {
    this.sheetSnap.set(snap);
    this.sheetLastEvent.set(`snapChange: ${snap} — ${new Date().toLocaleTimeString()}`);
  }

  protected onSheetShortcut(shortcut: ChatShortcut): void {
    // Um consumidor real mandaria isto para a IA e esvaziaria `shortcuts` a
    // partir da primeira mensagem (spec.md § Diretrizes de Uso). Aqui só
    // registramos, para a faixa continuar visível durante o teste manual.
    this.sheetLastEvent.set(`shortcutSelect: ${shortcut.id} — "${shortcut.label}"`);
  }
}
