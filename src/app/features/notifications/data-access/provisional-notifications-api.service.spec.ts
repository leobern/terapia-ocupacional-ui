import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { NotificationsRepository } from './notifications-repository.service';
import { ProvisionalHomeApiService, ProvisionalNotificationsApiService } from './provisional-notifications-api.service';

describe('Provisional notification APIs', () => {
  it('reads pages from the in-memory repository', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), ProvisionalNotificationsApiService] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);

    const page = await firstValueFrom(api.getNotifications(1, 'pending', null, 2));

    expect(page.items.length).toBe(2);
    expect(page.totalCount).toBe(TestBed.inject(NotificationsRepository).list('pending', null, 50).totalCount);
  });

  it('createReply records the reply', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), ProvisionalNotificationsApiService] });
    const api = TestBed.inject(ProvisionalNotificationsApiService);
    const target = TestBed.inject(NotificationsRepository).list('pending', null, 1).items[0];

    const reply = await firstValueFrom(api.createReply(target.id, 'feito'));

    expect(reply.text).toBe('feito');
  });

  it('lists a single hospital, the same one the Home shows', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), ProvisionalHomeApiService] });

    expect(await firstValueFrom(TestBed.inject(ProvisionalHomeApiService).getHospitals())).toEqual([
      { id: 1, name: 'Hospital Vila Nova Star' },
    ]);
  });
});
