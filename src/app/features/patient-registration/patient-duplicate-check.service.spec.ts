import { TestBed } from '@angular/core/testing';

import { HospitalContextService } from '../home/hospital-context.service';
import { LinkRevocationChecker } from '../home/link-revocation-checker';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { PatientDuplicateCheckService } from './patient-duplicate-check.service';
import { PatientDuplicateError } from './patient-duplicate-error';
import { PatientDuplicateSource } from './patient-duplicate-source';
import { ProvisionalPatientDuplicateSource } from './provisional-patient-duplicate-source';

describe('PatientDuplicateCheckService (fonte provisória)', () => {
  let service: PatientDuplicateCheckService;
  let find: jasmine.Spy;

  beforeEach(() => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    TestBed.configureTestingModule({
      providers: [
        { provide: PatientDuplicateSource, useClass: ProvisionalPatientDuplicateSource },
        { provide: LinkRevocationChecker, useValue: { isRevoked: (): Promise<boolean> => Promise.resolve(false) } },
        { provide: LinkedHospitalsReader, useValue: { read: (): Promise<[]> => Promise.resolve([]) } },
      ],
    });
    const source = TestBed.inject(PatientDuplicateSource);

    find = spyOn(source, 'find').and.callThrough();
    service = TestBed.inject(PatientDuplicateCheckService);
  });

  it('Cenário 1: sem correspondência segue para o sexo', async () => {
    const outcome = await service.check({ birthDate: '14/03/1985', fullName: 'Maria Aparecida Souza', hospitalId: 1 });

    expect(outcome).toEqual({ kind: 'no-match', next: 'sex' });
    expect(find).toHaveBeenCalledWith(1, 'Maria Aparecida Souza', '1985-03-14');
  });

  it('Cenário 2: exibe nome, data e SAME do paciente encontrado antes de continuar', async () => {
    const outcome = await service.check({ birthDate: '02/07/1990', fullName: 'João Pedro Lima', hospitalId: 1 });

    expect(outcome).toEqual({
      kind: 'matches',
      lines: ['Nome: João Pedro Lima · Data de nascimento: 02/07/1990 · SAME: 12345'],
      next: 'sex',
    });
  });

  it('Cenário 3: paciente de outro hospital não corresponde', async () => {
    const outcome = await service.check({ birthDate: '20/05/1978', fullName: 'Ana Clara Ferreira', hospitalId: 1 });

    expect(outcome.kind).toBe('no-match');
    expect((await service.check({ birthDate: '20/05/1978', fullName: 'Ana Clara Ferreira', hospitalId: 2 })).kind).toBe(
      'matches',
    );
  });

  it('Cenário 4: ignora acentuação e caixa, mas a data é exata; SAME vazio não é exibido', async () => {
    const outcome = await service.check({ birthDate: '10/01/1960', fullName: 'jose antonio', hospitalId: 1 });

    expect(outcome).toEqual({
      kind: 'matches',
      lines: ['Nome: José Antônio · Data de nascimento: 10/01/1960'],
      next: 'sex',
    });

    expect((await service.check({ birthDate: '11/01/1960', fullName: 'jose antonio', hospitalId: 1 })).kind).toBe(
      'no-match',
    );
  });

  it('MSG-01: nome com menos de 3 caracteres não consulta a fonte', async () => {
    const outcome = await service.check({ birthDate: '10/01/1960', fullName: ' Jo ', hospitalId: 1 });

    expect(outcome).toEqual({ kind: 'invalid-name', message: 'Digite pelo menos 3 caracteres para buscar.' });
    expect(find).not.toHaveBeenCalled();
  });

  it('MSG-02: data inválida ou futura não consulta a fonte', async () => {
    const outcomes = await Promise.all(
      ['31/02/2000', '01/01/2999'].map(birthDate =>
        service.check({ birthDate, fullName: 'Maria Souza', hospitalId: 1 }),
      ),
    );

    for (const outcome of outcomes) {
      expect(outcome).toEqual({ kind: 'invalid-date', message: 'Informe uma data de nascimento válida.' });
    }

    expect(find).not.toHaveBeenCalled();
  });

  it('exibe todos os correspondentes', async () => {
    find.and.resolveTo([
      { birthDate: '2000-01-01', fullName: 'A B C', medicalRecordNumber: '1' },
      { birthDate: '2000-01-01', fullName: 'a b c', medicalRecordNumber: null },
    ]);

    const outcome = await service.check({ birthDate: '01/01/2000', fullName: 'A B C', hospitalId: 1 });

    expect(outcome.kind === 'matches' && outcome.lines.length).toBe(2);
  });

  it('propaga falha da fonte', async () => {
    find.and.rejectWith(new Error('boom'));

    await expectAsync(service.check({ birthDate: '01/01/2000', fullName: 'A B C', hospitalId: 1 })).toBeRejected();
  });

  describe('falhas da API', () => {
    const input = { birthDate: '01/01/2000', fullName: 'A B C', hospitalId: 1 };
    let revoked: boolean;
    let revokeAccess: jasmine.Spy;

    beforeEach(() => {
      revoked = true;
      const context = TestBed.inject(HospitalContextService);

      spyOn(context, 'revokeAccess');
      revokeAccess = context.revokeAccess as jasmine.Spy;
      TestBed.inject(LinkRevocationChecker).isRevoked = (): Promise<boolean> => Promise.resolve(revoked);
    });

    it('422 volta às mensagens MSG-01/MSG-02', async () => {
      find.and.rejectWith(new PatientDuplicateError('invalid-name'));

      expect((await service.check(input)).kind).toBe('invalid-name');

      find.and.rejectWith(new PatientDuplicateError('invalid-date'));

      expect((await service.check(input)).kind).toBe('invalid-date');
    });

    it('403 com vínculo revogado revoga o acesso e não continua', async () => {
      find.and.rejectWith(new PatientDuplicateError('access-denied'));

      expect((await service.check(input)).kind).toBe('access-denied');
      expect(revokeAccess).toHaveBeenCalledWith(1);
    });

    it('403 sem revogação confirmada só nega', async () => {
      revoked = false;
      find.and.rejectWith(new PatientDuplicateError('access-denied'));

      expect((await service.check(input)).kind).toBe('access-denied');
      expect(revokeAccess).not.toHaveBeenCalled();
    });

    it('401 e indisponibilidade têm mensagem própria', async () => {
      find.and.rejectWith(new PatientDuplicateError('session-expired'));

      expect(await service.check(input)).toEqual({
        kind: 'session-expired',
        message: 'Sua sessão expirou. Entre novamente.',
      });

      find.and.rejectWith(new PatientDuplicateError('unavailable'));

      expect((await service.check(input)).kind).toBe('unavailable');
    });
  });
});
