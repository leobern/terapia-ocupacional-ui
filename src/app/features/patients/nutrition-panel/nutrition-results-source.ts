import { NutritionValues } from './nutrition-panel.models';

/**
 * Porta de leitura dos resultados exibidos no Painel Nutricional (FT-004-3, US2): NRS-2002, GLIM e
 * SARC-F (motores de origem), tipo de terapia (prescrição ativa, FT-004-8). A % de adequação
 * NÃO vem daqui: é calculada uma vez por `DailyAdequacyService` (FT-004-7). Somente leitura; a implementação real substitui a provisória em `app.config.ts`.
 * Indicador sem resultado fica ausente do objeto.
 */
export abstract class NutritionResultsSource {
  abstract load(patientId: string): Promise<NutritionValues>;
}
