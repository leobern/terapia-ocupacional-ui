import { TestBed } from '@angular/core/testing';

import { NOW, ProfessionalProfile, ProfessionalProfileReader } from './professional-profile';

describe('professional-profile', () => {
  it('NOW devolve, por padrão, a data atual', () => {
    const before = Date.now();
    const now = TestBed.inject(NOW)();

    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('o leitor de perfil é uma fronteira abstrata, substituível', () => {
    class Fixed extends ProfessionalProfileReader {
      read(): ProfessionalProfile {
        return { name: 'Fulana', role: 'other' };
      }
    }

    expect(new Fixed().read().name).toBe('Fulana');
  });
});
