import { TestBed } from '@angular/core/testing';

import { I18nService } from './i18n.service';

describe('I18nService', () => {
  it('resolves nested keys', () => {
    const service = TestBed.inject(I18nService);

    expect(service.t('splash.logoLabel')).toBe('Conductia');
  });

  it('returns the key itself when it does not exist', () => {
    const service = TestBed.inject(I18nService);

    expect(service.t('splash.nope')).toBe('splash.nope');
    expect(service.t('app')).toBe('app');
    expect(service.t('app.title.deeper')).toBe('app.title.deeper');
  });

  it('uses English when the browser language is English', () => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('en-US');

    expect(TestBed.inject(I18nService).t('splash.retry')).toBe('Try again');
  });

  it('uses pt-BR otherwise', () => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');

    expect(TestBed.inject(I18nService).t('splash.retry')).toBe('Tentar novamente');
  });
});
