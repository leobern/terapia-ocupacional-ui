/** Paciente encontrado pela verificação de duplicidade (data em ISO `yyyy-MM-dd`; SAME `null` = não preenchido). */
export interface PatientMatch {
  readonly birthDate: string;
  readonly fullName: string;
  readonly medicalRecordNumber: string | null;
}

/** Dados já extraídos da conversa (a extração em linguagem natural é do motor de IA). */
export interface DuplicateCheckInput {
  /** Data como o usuário informou: `dd/MM/yyyy` ou ISO `yyyy-MM-dd`. */
  readonly birthDate: string;
  readonly fullName: string;
  /** Hospital ativo na sessão (RN-01). */
  readonly hospitalId: number;
}

/** Próximo passo da conversa quando a verificação não encontrou erro de validação. */
export type DuplicateCheckOutcome =
  | { readonly kind: 'invalid-name'; readonly message: string }
  | { readonly kind: 'invalid-date'; readonly message: string }
  | { readonly kind: 'access-denied'; readonly message: string }
  | { readonly kind: 'session-expired'; readonly message: string }
  | { readonly kind: 'unavailable'; readonly message: string }
  | { readonly kind: 'no-match'; readonly next: 'sex' }
  | { readonly kind: 'matches'; readonly lines: readonly string[]; readonly next: 'sex' };
