// Espelham specs/003-home/contracts/home-api.yaml. Este arquivo é um stand-in
// manual para o client gerado por `pnpm models` (openapi-generator-cli) — ver
// a nota em home-api.service.ts sobre por que ele foi escrito à mão nesta
// implementação.

export type GoalStatus = 'NORMAL' | 'ALERTA' | 'CRITICO';

export interface NutritionalGoalIndicator {
  caloricPercentage: number;
  caloricStatus: GoalStatus;
  proteinPercentage: number;
  proteinStatus: GoalStatus;
}

export interface HomeSummary {
  patientCount: number;
  nutritionalGoalIndicator: NutritionalGoalIndicator;
  unreadNotificationCount: number;
}

export interface ProfessionalRef {
  id: number;
  name: string;
  specialty: string;
  photoUrl: string | null;
}

export interface HomeNotification {
  id: number;
  author: ProfessionalRef;
  description: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationPage {
  items: HomeNotification[];
  nextCursor: string | null;
}

export interface Hospital {
  id: number;
  name: string;
}
