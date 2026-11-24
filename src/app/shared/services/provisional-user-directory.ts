import { Injectable } from '@angular/core';

import { type DirectoryUser, UserDirectory } from './user-directory';

const PEOPLE: readonly DirectoryUser[] = [
  { id: 1, name: 'Rafael Dutra Rabello Euarte', photoUrl: null, specialty: 'Nutrólogo' },
  { id: 2, name: 'Filippa Martins', photoUrl: null, specialty: 'Nutricionista' },
  { id: 3, name: 'Jairo Nepomuceno', photoUrl: null, specialty: 'Farmacêutico' },
  { id: 4, name: 'Michelle Franklin', photoUrl: null, specialty: 'Nutróloga' },
  { id: 5, name: 'Almira Borges Pereira', photoUrl: null, specialty: 'Enfermeira' },
  { id: 6, name: 'Samuel Lima Rocha', photoUrl: null, specialty: 'Fonoaudiólogo' },
];

/** Perfil de cada especialidade (base da resolução dos grupos). */
const PROFILE_BY_SPECIALTY: Readonly<Record<string, string>> = {
  Enfermeira: 'enfermeiros',
  Farmacêutico: 'farmaceuticos',
  Fonoaudiólogo: 'fonoaudiologos',
  Nutricionista: 'nutricionistas',
  Nutróloga: 'medicos',
  Nutrólogo: 'medicos',
};

/** Perfis oferecidos como grupo; `psicologos` ainda não tem ninguém vinculado (grupo vazio). */
const PROFILES: readonly string[] = [
  'enfermeiros',
  'farmaceuticos',
  'fonoaudiologos',
  'medicos',
  'nutricionistas',
  'psicologos',
];

/** Pessoas atingidas por um grupo: `null` = todos os vinculados; senão, as do perfil informado. */
export const membersOfGroup = (profile: string | null): readonly DirectoryUser[] =>
  PEOPLE.filter(person => profile === null || PROFILE_BY_SPECIALTY[person.specialty] === profile);

const GROUPS: readonly DirectoryUser[] = [
  {
    group: { memberCount: membersOfGroup(null).length, profile: null },
    id: -1,
    name: 'todos',
    photoUrl: null,
    specialty: 'Todos os vinculados ao hospital',
  },
  ...PROFILES.map((profile, index): DirectoryUser => {
    const memberCount = membersOfGroup(profile).length;

    return {
      group: { memberCount, profile },
      id: -(index + 2),
      name: profile,
      photoUrl: null,
      specialty: `Grupo por perfil (${memberCount} ${memberCount === 1 ? 'pessoa' : 'pessoas'})`,
    };
  }),
];

const USERS: readonly DirectoryUser[] = [...PEOPLE, ...GROUPS];

/** Remove acentos e caixa para comparar nomes. */
const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Provisório: lista fixa de exemplo até existir a API de usuários. */
@Injectable()
export class ProvisionalUserDirectory extends UserDirectory {
  search(term: string): Promise<readonly DirectoryUser[]> {
    const query = normalize(term.trim());

    return Promise.resolve(USERS.filter(user => normalize(user.name).includes(query)));
  }
}
