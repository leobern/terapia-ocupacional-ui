import { ProvisionalHospitalLinksSource } from './provisional-hospital-links-source';

describe('ProvisionalHospitalLinksSource', () => {
  it('devolve um vínculo para cada um dos 4 status', async () => {
    const { items, hasApprovedLink } = await new ProvisionalHospitalLinksSource().list();

    expect(items.map(item => item.status).sort((a, b) => a.localeCompare(b))).toEqual([
      'approved',
      'pending',
      'refused',
      'revoked',
    ]);

    expect(hasApprovedLink).toBeTrue();
  });
});
