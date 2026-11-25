import { Injectable } from '@angular/core';

import { HospitalLinkList } from './hospital-links.models';
import { HospitalLinksSource } from './hospital-links-source';

/** Fonte provisória: um vínculo por status, até a tela falar com a API. */
@Injectable()
export class ProvisionalHospitalLinksSource extends HospitalLinksSource {
  list(): Promise<HospitalLinkList> {
    return Promise.resolve({
      hasApprovedLink: true,
      items: [
        { hospitalId: 1, hospitalName: 'Hospital Alfa', id: 1, status: 'approved', updatedAt: '2026-11-20T10:00:00Z' },
        { hospitalId: 2, hospitalName: 'Hospital Beta', id: 2, status: 'pending', updatedAt: '2026-11-22T09:00:00Z' },
        { hospitalId: 3, hospitalName: 'Hospital Gama', id: 3, status: 'refused', updatedAt: '2026-11-18T14:00:00Z' },
        { hospitalId: 4, hospitalName: 'Hospital Delta', id: 4, status: 'revoked', updatedAt: '2026-11-10T08:00:00Z' },
      ],
    });
  }
}
