import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarComponent } from './avatar.component';

describe('AvatarComponent', () => {
  let fixture: ComponentFixture<AvatarComponent>;

  async function createWith(name: string, photoUrl: string | null = null): Promise<void> {
    await TestBed.configureTestingModule({ imports: [AvatarComponent] }).compileComponents();
    fixture = TestBed.createComponent(AvatarComponent);
    fixture.componentRef.setInput('name', name);
    fixture.componentRef.setInput('photoUrl', photoUrl);
    fixture.detectChanges();
  }

  it('exibe a foto quando photoUrl está presente', async () => {
    await createWith('Jairo Nepomuceno', 'https://example.com/foto.png');
    const img = fixture.nativeElement.querySelector('img.avatar--photo');

    expect(img).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.avatar--initials')).toBeFalsy();
  });

  it('sem foto, mostra 2 letras: inicial do primeiro + inicial do último nome (FR-005b)', async () => {
    await createWith('Jairo Nepomuceno');
    const initials = fixture.nativeElement.querySelector('.avatar--initials');

    expect(initials.textContent.trim()).toBe('JN');
  });

  it('nome com mais de 2 palavras: usa só a 1ª e a última (não a do meio)', async () => {
    await createWith('Rafael Dutra Rabello Duarte');
    const initials = fixture.nativeElement.querySelector('.avatar--initials');

    expect(initials.textContent.trim()).toBe('RD');
  });

  it('nome com uma única palavra: mostra só 1 letra (FR-005b)', async () => {
    await createWith('Madonna');
    const initials = fixture.nativeElement.querySelector('.avatar--initials');

    expect(initials.textContent.trim()).toBe('M');
  });

  it('nome vazio ou só com espaços: não gera iniciais', async () => {
    await createWith('   ');
    const initials = fixture.nativeElement.querySelector('.avatar--initials');

    expect(initials.textContent.trim()).toBe('');
  });
});
