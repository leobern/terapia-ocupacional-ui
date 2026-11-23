import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NotificationPage } from '../home.models';
import { HospitalContextService } from '../hospital-context.service';
import { LinkedHospitalsReader } from '../linked-hospitals';
import { HomeNotificationsApiService } from './home-notifications-api.service';

describe('HomeNotificationsApiService', () => {
  let service: HomeNotificationsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HomeNotificationsApiService,
        {
          provide: LinkedHospitalsReader,
          useValue: { read: (): Promise<{ id: number; name: string }[]> => Promise.resolve([{ id: 12, name: 'H' }]) },
        },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(HomeNotificationsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pede o primeiro lote ao backend com hospital numérico e limite', async () => {
    const page: NotificationPage = { items: [], nextCursor: null };
    const result = service.loadPage(7, null, 10);

    const req = http.expectOne(r => r.url.endsWith('/v1/home/notifications'));

    expect(req.request.params.get('hospitalId')).toBe('7');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush(page);

    expect(await result).toEqual(page);
  });

  it('envia o cursor nos lotes seguintes', async () => {
    const result = service.loadPage(1, 'abc', 10);

    const req = http.expectOne(r => r.url.endsWith('/v1/home/notifications'));

    expect(req.request.params.get('cursor')).toBe('abc');
    req.flush({ items: [], nextCursor: null });
    await result;
  });

  it('usa o id numérico do hospital em contexto, sem NaN', async () => {
    const context = TestBed.inject(HospitalContextService);

    await context.load();
    const result = service.loadPage(context.selected()?.id as number, null, 10);

    const req = http.expectOne(r => r.url.endsWith('/v1/home/notifications'));

    expect(req.request.params.get('hospitalId')).toBe('12');
    expect(req.request.params.get('hospitalId')).not.toBe('NaN');
    req.flush({ items: [], nextCursor: null });
    await result;
  });

  it('rejeita quando o backend responde erro (ex.: 403)', async () => {
    const result = service.loadPage(1, null, 10);

    http
      .expectOne(r => r.url.endsWith('/v1/home/notifications'))
      .flush({ message: 'x' }, { status: 403, statusText: 'Forbidden' });

    await expectAsync(result).toBeRejected();
  });
});
