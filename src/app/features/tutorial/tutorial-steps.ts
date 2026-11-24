/** Passo do tutorial: ícone Phosphor e chaves de tradução. */
export interface TutorialStep {
  readonly icon: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
}

/**
 * RN01: no máximo 5 passos. Número e conteúdo exatos a definir com Thiago (UX);
 * esta lista é o único lugar a trocar.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { descriptionKey: 'tutorial.steps.home.description', icon: 'house', titleKey: 'tutorial.steps.home.title' },
  {
    descriptionKey: 'tutorial.steps.patients.description',
    icon: 'users-four',
    titleKey: 'tutorial.steps.patients.title',
  },
  {
    descriptionKey: 'tutorial.steps.notifications.description',
    icon: 'bell',
    titleKey: 'tutorial.steps.notifications.title',
  },
  {
    descriptionKey: 'tutorial.steps.assistant.description',
    icon: 'squares-four',
    titleKey: 'tutorial.steps.assistant.title',
  },
];
