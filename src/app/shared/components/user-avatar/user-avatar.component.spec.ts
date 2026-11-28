import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserPhotoService } from '../../services/user-photo.service';
import { UserAvatarComponent } from './user-avatar.component';

describe('UserAvatarComponent', () => {
  let fixture: ComponentFixture<UserAvatarComponent>;
  let photos: jasmine.SpyObj<UserPhotoService>;
  const version = { value: 0 };

  beforeEach(() => {
    photos = jasmine.createSpyObj<UserPhotoService>('UserPhotoService', ['url']);
    Object.defineProperty(photos, 'version', { get: () => (): number => version.value });
    photos.url.and.resolveTo('blob:foto');
    TestBed.configureTestingModule({
      imports: [UserAvatarComponent],
      providers: [{ provide: UserPhotoService, useValue: photos }],
    });
    fixture = TestBed.createComponent(UserAvatarComponent);
  });

  it('com foto mostra a imagem baixada', async () => {
    fixture.componentRef.setInput('userId', 7);
    fixture.componentRef.setInput('name', 'Rafael Dutra');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(photos.url).toHaveBeenCalledWith(7);
    expect((fixture.nativeElement as HTMLElement).querySelector('img')?.getAttribute('src')).toBe('blob:foto');
  });

  it('sem foto (null) cai nas iniciais', async () => {
    photos.url.and.resolveTo(null);
    fixture.componentRef.setInput('userId', 7);
    fixture.componentRef.setInput('name', 'Rafael Dutra');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('img')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('RD');
  });

  it('sem id ou com hasPhoto=false nem consulta a foto', async () => {
    fixture.componentRef.setInput('userId', null);
    fixture.detectChanges();
    fixture.componentRef.setInput('userId', 3);
    fixture.componentRef.setInput('hasPhoto', false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(photos.url).not.toHaveBeenCalled();
  });

  it('descarta a resposta de uma consulta antiga', async () => {
    let resolveFirst!: (value: string | null) => void;

    photos.url.and.returnValues(new Promise(resolve => (resolveFirst = resolve)), Promise.resolve('blob:novo'));
    fixture.componentRef.setInput('userId', 1);
    fixture.detectChanges();
    fixture.componentRef.setInput('userId', 2);
    fixture.detectChanges();
    await fixture.whenStable();
    resolveFirst('blob:velho');
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('img')?.getAttribute('src')).toBe('blob:novo');
  });
});
