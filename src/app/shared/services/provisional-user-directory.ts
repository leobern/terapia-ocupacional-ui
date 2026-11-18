import { Injectable } from '@angular/core';

import { type DirectoryUser, UserDirectory } from './user-directory';

const USERS: readonly DirectoryUser[] = [
  { id: 1, name: 'Rafael Dutra Rabello Euarte', photoUrl: null, specialty: 'Nutrólogo' },
  { id: 2, name: 'Filippa Martins', photoUrl: null, specialty: 'Nutricionista' },
  { id: 3, name: 'Jairo Nepomuceno', photoUrl: null, specialty: 'Farmacêutico' },
  { id: 4, name: 'Michelle Franklin', photoUrl: null, specialty: 'Nutróloga' },
  { id: 5, name: 'Almira Borges Pereira', photoUrl: null, specialty: 'Enfermeira' },
  { id: 6, name: 'Samuel Lima Rocha', photoUrl: null, specialty: 'Fonoaudiólogo' },
];

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
