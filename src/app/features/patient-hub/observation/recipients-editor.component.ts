import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  PROFILE_GROUPS,
  ProfileGroup,
  Recipients,
  resolveRecipients,
  TeamMember,
  validateRecipients,
} from './observation.models';

/**
 * Destinatários de uma pendência: grupo por perfil (resolvido só para vinculados ao paciente) e pessoas
 * específicas. Sempre sobra ao menos um destinatário válido: grupo vazio é rejeitado com aviso.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-recipients-editor',
  styleUrl: './recipients-editor.component.scss',
  templateUrl: './recipients-editor.component.html',
})
export class RecipientsEditorComponent {
  readonly team = input.required<readonly TeamMember[]>();
  readonly value = input.required<Recipients>();
  readonly idPrefix = input('rcp');
  readonly disabled = input(false);
  readonly changed = output<Recipients>();

  protected readonly groups = PROFILE_GROUPS;
  protected readonly error = computed(() => validateRecipients(this.value(), this.team()));
  protected readonly resolved = computed(() => resolveRecipients(this.value(), this.team()));

  protected selectGroup(raw: string): void {
    this.changed.emit({ ...this.value(), group: raw === '' ? null : (raw as ProfileGroup) });
  }

  protected isPicked(member: TeamMember): boolean {
    return this.value().people.some(p => p.id === member.id);
  }

  protected toggle(member: TeamMember): void {
    const people = this.isPicked(member)
      ? this.value().people.filter(p => p.id !== member.id)
      : [...this.value().people, member];

    this.changed.emit({ ...this.value(), people });
  }
}
