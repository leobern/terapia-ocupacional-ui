import { AdminHospital, Interaction, PersonDetail, Profile, TeamMember } from './administration.models';
import { AdministrationApi } from './administration-api';

/** Dados e dublê do cliente da Administração para os testes das telas. */
export const MEMBER: TeamMember = {
  conviteId: null,
  convidadoEm: '2026-02-03T10:00:00',
  convidadoPor: 'Almira Conductia',
  email: 'rafael@hsl.org',
  hospitais: [{ id: 1, nome: 'Hospital A' }],
  nome: 'Rafael Dutra',
  papel: 'MEDICO',
  situacao: 'ATIVO',
  temFoto: false,
  ultimoAcesso: '2026-11-27T19:03:00',
  usuarioId: 7,
};

export const INVITED: TeamMember = {
  ...MEMBER,
  conviteId: 9,
  convidadoEm: null,
  email: 'novo@hsl.org',
  hospitais: [],
  nome: 'novo@hsl.org',
  situacao: 'CONVIDADO',
  ultimoAcesso: null,
  usuarioId: null,
};

export const DEACTIVATED: TeamMember = {
  ...MEMBER,
  email: 'carla@hsl.org',
  nome: 'Carla Mendes',
  situacao: 'DESATIVADO',
  usuarioId: 8,
};

export const HOSPITAL: AdminHospital = {
  ativo: true,
  criadoEm: '2026-02-03T10:00:00',
  endereco: 'Rua das Palmeiras, 1200',
  gestor: 'Paula Andrade',
  id: 1,
  nome: 'Hospital A',
  pacientes: 3,
  pessoas: 2,
};

export const DETAIL: PersonDetail = {
  pessoa: MEMBER,
  vinculos: [
    {
      desde: '2026-02-03T10:00:00',
      endereco: 'Rua das Palmeiras, 1200',
      hospitalId: 1,
      hospitalNome: 'Hospital A',
      papelHospital: 'PROFISSIONAL',
      status: 'APROVADO',
      vinculoId: 11,
    },
  ],
};

export const INTERACTIONS: Interaction[] = [
  {
    notificacaoId: null,
    pacienteId: 5,
    pacienteNome: 'Camila Tavares',
    quando: '2026-11-27T08:12:00',
    resolvida: true,
    texto: 'Tolerância à dieta enteral.',
    tipo: 'EVOLUCAO',
  },
  {
    notificacaoId: 3,
    pacienteId: null,
    pacienteNome: null,
    quando: null,
    resolvida: false,
    texto: 'Reunião às 13h.',
    tipo: 'COMUNICADO',
  },
];

export const PROFILE: Profile = {
  email: 'rafael@hsl.org',
  especialidade: 'Nutrologia',
  hospitais: [{ id: 1, nome: 'Hospital A' }],
  id: 7,
  membroDesde: '2026-02-03T10:00:00',
  nomeCompleto: 'Rafael Dutra',
  papel: 'MEDICO',
  registroProfissional: 'CRM 123',
  telefone: '11 99999-0000',
  temFoto: false,
  ultimoAcesso: null,
};

export type ApiSpy = jasmine.SpyObj<AdministrationApi>;

export function createApiSpy(): ApiSpy {
  const api = jasmine.createSpyObj<AdministrationApi>('AdministrationApi', [
    'listTeam',
    'personDetail',
    'personInteractions',
    'link',
    'unlink',
    'deactivate',
    'reactivate',
    'changeRole',
    'invite',
    'resendInvite',
    'cancelInvite',
    'listHospitals',
    'createHospital',
    'updateHospital',
    'setHospitalActive',
    'myProfile',
    'saveProfile',
    'myInteractions',
  ]);

  api.listTeam.and.resolveTo([MEMBER, INVITED, DEACTIVATED]);
  api.personDetail.and.resolveTo(DETAIL);
  api.personInteractions.and.resolveTo(INTERACTIONS);
  api.listHospitals.and.resolveTo([
    HOSPITAL,
    { ...HOSPITAL, ativo: false, endereco: null, gestor: null, id: 2, nome: 'Hospital B', pacientes: 1, pessoas: 1 },
  ]);
  api.myProfile.and.resolveTo(PROFILE);
  api.myInteractions.and.resolveTo(INTERACTIONS);
  for (const name of ['link', 'unlink', 'deactivate', 'reactivate', 'changeRole', 'cancelInvite'] as const) {
    api[name].and.resolveTo({});
  }
  api.invite.and.resolveTo({
    emailEnviado: false,
    email: 'novo@hsl.org',
    expiraEm: '2026-12-04T10:00:00',
    id: 9,
    link: 'https://x/invite?token=abc',
    papel: 'MEDICO',
    vinculoDireto: false,
  });
  api.resendInvite.and.resolveTo({
    emailEnviado: false,
    email: 'novo@hsl.org',
    expiraEm: '2026-12-04T10:00:00',
    id: 9,
    link: 'https://x/invite?token=def',
    papel: 'MEDICO',
    vinculoDireto: false,
  });
  api.createHospital.and.resolveTo(HOSPITAL);
  api.updateHospital.and.resolveTo(HOSPITAL);
  api.setHospitalActive.and.resolveTo(HOSPITAL);
  api.saveProfile.and.resolveTo(PROFILE);

  return api;
}
