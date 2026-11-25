import { Injectable } from '@angular/core';

import { ClinicalAssessment } from './clinical-assessment.models';
import { ClinicalAssessmentSource } from './clinical-assessment-source';

const key = (patientId: string): string => `conductia:clinical-assessment:v2:${patientId}`;

/** Exemplo do Figma (Pacientes · Avaliação clínica) até existir o cadastro real. */
const SEED: ClinicalAssessment = {
  device: 'SNE',
  heightCm: 153,
  items: [
    {
      id: 'nrs',
      ranges: [
        { from: 0, label: 'Sem risco', to: 2, tone: 'success' },
        { from: 3, label: 'Em risco', to: 7, tone: 'warning' },
      ],
      title: 'NRS-2002',
      unit: 'pontos',
      value: '4',
    },
    {
      id: 'glim',
      ranges: [
        { from: 0, label: 'Sem desnutrição', to: 0, tone: 'success' },
        { from: 1, label: 'Moderado', to: 1, tone: 'secondary' },
        { from: 2, label: 'Grave', to: 2, tone: 'alert' },
      ],
      title: 'GLIM',
      unit: '',
      value: '1',
    },
    {
      id: 'sarcf',
      ranges: [
        { from: 0, label: 'Sem sinal', to: 3, tone: 'success' },
        { from: 4, label: 'Sugestivo', to: 10, tone: 'alert' },
      ],
      title: 'SARC-F',
      unit: 'pontos',
      value: '4',
    },
    {
      id: 'panturrilha',
      ranges: [
        { from: 0, label: 'Abaixo', to: 10, tone: 'alert' },
        { from: 11, label: 'Limítrofe', to: 40, tone: 'warning' },
        { from: 41, label: 'Acima', to: 100, tone: 'secondary' },
      ],
      title: 'Panturrilha',
      unit: 'cm',
      value: '31',
    },
    {
      id: 'handgrip',
      ranges: [
        { from: 0, label: 'Baixo', to: 20, tone: 'alert' },
        { from: 21, label: 'Adequado', to: 100, tone: 'success' },
      ],
      title: 'Hand grip',
      unit: 'kgf',
      value: '14',
    },
    {
      id: 'angulo-fase',
      ranges: [
        { from: 0, label: 'Baixo', to: 5, tone: 'alert' },
        { from: 5.1, label: 'Adequado', to: 15, tone: 'success' },
      ],
      title: 'Ângulo de fase',
      unit: 'graus',
      value: '4,2',
    },
    {
      id: 'glicemia',
      ranges: [
        { from: 0, label: 'Abaixo do alvo', to: 70, tone: 'alert' },
        { from: 71, label: 'No alvo', to: 180, tone: 'success' },
        { from: 181, label: 'Acima do alvo', to: 600, tone: 'warning' },
      ],
      title: 'Glicemia',
      unit: 'mg/dL',
      value: '183–257',
    },
    {
      id: 'intestino',
      ranges: [
        { from: 0, label: 'Normal', to: 2, tone: 'success' },
        { from: 3, label: 'Atenção', to: 10, tone: 'warning' },
      ],
      title: 'Intestino',
      unit: 'evac. líquidas',
      value: '5',
    },
  ],
  previousWeight: { at: '20/05', kg: 50.4 },
  tnType: 'NE',
  weightKg: 51,
};

/** Paciente novo, sem avaliação: a tela mostra o card de estado vazio. */
const EMPTY: ClinicalAssessment = { device: '', heightCm: null, items: [], tnType: '', weightKg: null };

/** Provisório: só o paciente `p1` tem o exemplo; os demais começam vazios. Grava no `localStorage`. */
@Injectable()
export class ProvisionalClinicalAssessmentSource extends ClinicalAssessmentSource {
  load(patientId: string): Promise<ClinicalAssessment> {
    const raw = localStorage.getItem(key(patientId));

    if (raw !== null) {
      return Promise.resolve(JSON.parse(raw) as ClinicalAssessment);
    }

    return Promise.resolve(patientId === 'p1' ? SEED : EMPTY);
  }

  save(patientId: string, assessment: ClinicalAssessment): Promise<void> {
    localStorage.setItem(key(patientId), JSON.stringify(assessment));

    return Promise.resolve();
  }
}
