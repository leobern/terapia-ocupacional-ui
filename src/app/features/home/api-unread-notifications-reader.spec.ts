import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { NotificationsApiService } from '../notifications/data-access/notifications-api.service';
import { type NotificationPage } from '../notifications/notifications.models';
import { ApiUnreadNotificationsReader } from './api-unread-notifications-reader';
import { HospitalContextService } from './hospital-context.service';
import { type LinkedHospital, LinkedHospitalsReader } from './linked-hospitals';

describe('ApiUnreadNotificationsReader', () => {
  const selected = signal<LinkedHospital | null>({ id: 7, name: 'Hospital A' });
  let api: jasmine.SpyObj<NotificationsApiService>;
  let hospitals: jasmine.SpyObj<LinkedHospitalsReader>;
  let reader: ApiUnreadNotificationsReader;

  const page = (unreadCount?: number): NotificationPage => ({ items: [], nextCursor: null, unreadCount });

  beforeEach(() => {
    selected.set({ id: 7, name: 'Hospital A' });
    api = jasmine.createSpyObj<NotificationsApiService>('NotificationsApiService', ['getNotifications']);
    hospitals = jasmine.createSpyObj<LinkedHospitalsReader>('LinkedHospitalsReader', ['read']);
    api.getNotifications.and.returnValue(of(page(5)));
    TestBed.configureTestingModule({
      providers: [
        ApiUnreadNotificationsReader,
        { provide: NotificationsApiService, useValue: api },
        { provide: HospitalContextService, useValue: { selected } },
        { provide: LinkedHospitalsReader, useValue: hospitals },
      ],
    });
    reader = TestBed.inject(ApiUnreadNotificationsReader);
  });

  it('devolve o unreadCount da API para o hospital em contexto', async () => {
    expect(await reader.countUnread()).toBe(5);
    expect(api.getNotifications).toHaveBeenCalledWith(7, 'pending', null, 1);
    expect(hospitals.read).not.toHaveBeenCalled();
  });

  it('lê de novo a cada chamada (o selo acompanha leitura, resposta e resolução)', async () => {
    api.getNotifications.and.returnValues(of(page(5)), of(page(2)));

    expect(await reader.countUnread()).toBe(5);
    expect(await reader.countUnread()).toBe(2);
  });

  it('sem hospital em contexto usa o primeiro vínculo', async () => {
    selected.set(null);
    hospitals.read.and.resolveTo([{ id: 9, name: 'Hospital B' }]);

    expect(await reader.countUnread()).toBe(5);
    expect(api.getNotifications).toHaveBeenCalledWith(9, 'pending', null, 1);
  });

  it('sem nenhum vínculo devolve 0 sem chamar a API', async () => {
    selected.set(null);
    hospitals.read.and.resolveTo([]);

    expect(await reader.countUnread()).toBe(0);
    expect(api.getNotifications).not.toHaveBeenCalled();
  });

  it('devolve 0 quando a resposta não traz unreadCount', async () => {
    api.getNotifications.and.returnValue(of(page()));

    expect(await reader.countUnread()).toBe(0);
  });

  it('devolve 0 quando a API falha', async () => {
    api.getNotifications.and.returnValue(throwError(() => new Error('falhou')));

    expect(await reader.countUnread()).toBe(0);
  });
});
