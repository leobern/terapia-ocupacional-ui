import { type ScreenContext } from './screen-actions.service';

/**
 * Texto do assistente por tela (Thiago, 2026-11-23): o painel identifica a tela e se apresenta com um texto coerente
 * com as ações dela, em vez da saudação genérica. Os atalhos (tips) da tela aparecem junto, acima do campo de mensagem.
 */
export const NOTIFICATIONS_CONTEXT: ScreenContext = {
  description:
    'Você está na tela de Notificações. Posso ajudar a criar uma notificação, editar uma existente ou responder às que estão pendentes. É só escolher um atalho ou me dizer o que você precisa.',
  title: 'Como posso ajudar nas notificações?',
};

export const HOME_CONTEXT: ScreenContext = {
  description:
    'Você está no início. Posso resumir as suas tarefas do dia, mostrar as notificações pendentes ou levar você até os pacientes. Me diga o que você precisa.',
  title: 'Como posso ajudar hoje?',
};

export const PATIENTS_CONTEXT: ScreenContext = {
  description:
    'Você está na lista de pacientes do dia. Posso ordenar ou filtrar a lista, cadastrar um paciente, encerrar um acompanhamento ou trocar um leito. É só escolher um atalho ou me dizer o que fazer.',
  title: 'Como posso ajudar com os pacientes?',
};

export const PATIENT_HUB_CONTEXT: ScreenContext = {
  description:
    'Você está no detalhe do paciente. Posso registrar uma observação ou mensagem para a equipe, registrar o dia, ajustar a prescrição ou abrir o diagnóstico. É só escolher um atalho ou me dizer o que você precisa.',
  title: 'Como posso ajudar com este paciente?',
};

export const PHARMACY_CONTEXT: ScreenContext = {
  description:
    'Você está na Farmácia. Posso ajudar a padronizar as fórmulas deste hospital para ficarem disponíveis nas prescrições. Me diga qual fórmula você quer ajustar.',
  title: 'Como posso ajudar na farmácia?',
};
