import { ASSESSMENT_SECTIONS, AssessmentFieldDefinition } from '../assessment/assessment.models';

/**
 * Itens fixos da "Avaliação nutricional e funcional" (Thiago, 2026-11-24): circunferência da panturrilha e braquial
 * (com o membro), calorimetria indireta, handgrip e risco de disfagia. Peso e altura saem daqui: vivem na Avaliação
 * clínica. A lista vem das definições da FT-004-4, sem os dois campos antropométricos.
 */
export const NUTRITIONAL_FUNCTIONAL_FIELDS: readonly AssessmentFieldDefinition[] = ASSESSMENT_SECTIONS.flatMap(
  section => section.fields,
).filter(field => field.id !== 'weight' && field.id !== 'height');
