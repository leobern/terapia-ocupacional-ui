import { Injectable } from '@angular/core';

import { LinkedHospital } from '../home/linked-hospitals';
import { HospitalSiteSource } from './hospital-site-source';
import { HospitalSite } from './shift.models';

const PREFIX = 'conductia:hospital-site:';
const key = (hospitalId: number): string => `${PREFIX}${hospitalId}`;

/** Provisório: guarda a localização no `localStorage` do navegador (sem backend). */
@Injectable()
export class ProvisionalHospitalSiteSource extends HospitalSiteSource {
  load(hospitalId: number): Promise<HospitalSite | null> {
    const raw = localStorage.getItem(key(hospitalId));

    return Promise.resolve(raw === null ? null : (JSON.parse(raw) as HospitalSite));
  }

  save(site: HospitalSite): Promise<void> {
    localStorage.setItem(key(site.hospitalId), JSON.stringify(site));

    return Promise.resolve();
  }

  listLocalHospitals(): Promise<readonly LinkedHospital[]> {
    const found: LinkedHospital[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i);
      const raw = name?.startsWith(PREFIX) ? localStorage.getItem(name) : null;
      const site = raw === null ? null : (JSON.parse(raw) as HospitalSite);

      if (site?.local === true && site.name !== undefined) {
        found.push({ id: site.hospitalId, name: site.name });
      }
    }

    return Promise.resolve(found);
  }
}
