import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { BadgeComponent } from '../badge/badge.component';
import { AvatarComponent } from './avatar.component';

describe('AvatarComponent', () => {
  let fixture: ComponentFixture<AvatarComponent>;

  // O host É a caixa visual do avatar (sem `display: contents`, mesmo padrão de
  // app-badge) — as classes/estilos ficam no próprio elemento `<app-avatar>`.
  function avatarEl(): HTMLElement {
    return fixture.nativeElement;
  }

  // Anexar ao document real para offsetWidth/offsetHeight e getComputedStyle
  // refletirem layout.
  let attachedContainer: HTMLElement | null = null;

  function attachToDom(): HTMLElement {
    const container = document.createElement('div');

    container.appendChild(fixture.nativeElement);
    document.body.appendChild(container);
    attachedContainer = container;

    return container;
  }

  afterEach(() => {
    attachedContainer?.remove();
    attachedContainer = null;
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarComponent);
    fixture.detectChanges();
  });

  it('defaults to size="default" and type="user"', () => {
    expect(avatarEl().classList).toContain('avatar--default');
    expect(avatarEl().classList).toContain('avatar--user');
  });

  describe('size × type combinations (dimension, content, background)', () => {
    const sizes: ['small' | 'default' | 'big', number][] = [
      ['small', 32],
      ['default', 56],
      ['big', 120],
    ];

    for (const [size, px] of sizes) {
      describe(`size="${size}"`, () => {
        beforeEach(() => {
          fixture.componentRef.setInput('size', size);
        });

        it(`renders a ${px}x${px} container`, () => {
          attachToDom();
          fixture.detectChanges();

          expect(avatarEl().offsetWidth).toBe(px);
          expect(avatarEl().offsetHeight).toBe(px);
        });

        it('type="photo" renders an image and no initials text', () => {
          fixture.componentRef.setInput('type', 'photo');
          fixture.componentRef.setInput('imageUrl', 'https://example.com/photo.jpg');
          fixture.detectChanges();

          const img = avatarEl().querySelector('img.avatar__image') as HTMLImageElement;

          expect(img).toBeTruthy();
          expect(img.src).toBe('https://example.com/photo.jpg');
          expect(avatarEl().querySelector('.avatar__initials')).toBeNull();
        });

        it('type="user" renders initials and var(--color-tertiary) background', () => {
          fixture.componentRef.setInput('type', 'user');
          fixture.componentRef.setInput('name', 'Julia Nogueira');
          attachToDom();
          fixture.detectChanges();

          expect(avatarEl().querySelector('img.avatar__image')).toBeNull();
          expect(avatarEl().querySelector('.avatar__initials')?.textContent?.trim()).toBe('JN');
          expect(getComputedStyle(avatarEl()).backgroundColor).toBe('rgb(133, 224, 224)'); // --color-tertiary #85E0E0
        });

        it('type="patient" renders initials and var(--color-state-disabled) background', () => {
          fixture.componentRef.setInput('type', 'patient');
          fixture.componentRef.setInput('name', 'Julia Nogueira');
          attachToDom();
          fixture.detectChanges();

          expect(avatarEl().querySelector('img.avatar__image')).toBeNull();
          expect(avatarEl().querySelector('.avatar__initials')?.textContent?.trim()).toBe('JN');
          expect(getComputedStyle(avatarEl()).backgroundColor).toBe('rgb(199, 204, 209)'); // --color-state-disabled #C7CCD1
        });
      });
    }
  });

  describe('initials rule (FR-004/FR-005)', () => {
    const cases: [string | null, string][] = [
      ['Julia Nogueira', 'JN'],
      ['Ana Paula da Silva Nogueira', 'AN'],
      ['Julia', 'J'],
      [null, '--'],
      ['', '--'],
      ['   ', '--'],
      ['  julia   nogueira  ', 'JN'],
    ];

    for (const [name, expected] of cases) {
      it(`name=${JSON.stringify(name)} renders "${expected}"`, () => {
        fixture.componentRef.setInput('type', 'user');
        fixture.componentRef.setInput('name', name);
        fixture.detectChanges();

        const text = avatarEl().querySelector('.avatar__initials')?.textContent?.trim() ?? '';

        expect(text).toBe(expected);
        expect(text.length === 1 || text.length === 2).toBeTrue();
      });
    }
  });

  describe('edit badge availability (FR-006/FR-007)', () => {
    it('never renders the badge in size="small", even with editable=true', () => {
      fixture.componentRef.setInput('size', 'small');
      fixture.componentRef.setInput('editable', true);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.directive(BadgeComponent))).toBeNull();
    });

    it('does not render the badge when editable=false, regardless of size', () => {
      for (const size of ['small', 'default', 'big'] as const) {
        fixture.componentRef.setInput('size', size);
        fixture.componentRef.setInput('editable', false);
        fixture.detectChanges();

        expect(fixture.debugElement.query(By.directive(BadgeComponent))).toBeNull();
      }
    });

    for (const size of ['default', 'big'] as const) {
      it(`renders app-badge with icon="camera" when editable=true and size="${size}"`, () => {
        fixture.componentRef.setInput('size', size);
        fixture.componentRef.setInput('editable', true);
        fixture.detectChanges();

        const badge = fixture.debugElement.query(By.directive(BadgeComponent));

        expect(badge).toBeTruthy();
        expect(badge.componentInstance.icon()).toBe('camera');
        expect(badge.componentInstance.type()).toBe('icon');
      });
    }
  });

  describe('edit trigger — the WHOLE avatar circumference is clickable, not just the badge (user correction 2026-07-24)', () => {
    it('wraps the entire avatar content (photo/initials) in a real <button>, not just the badge', () => {
      fixture.componentRef.setInput('type', 'user');
      fixture.componentRef.setInput('name', 'Julia Nogueira');
      fixture.componentRef.setInput('editable', true);
      fixture.detectChanges();

      const button = avatarEl().querySelector('button.avatar__edit-trigger') as HTMLButtonElement;

      expect(button).toBeTruthy();
      expect(button.classList).toContain('avatar__content');
      expect(button.querySelector('.avatar__initials')?.textContent?.trim()).toBe('JN');
      // O badge é decorativo, sobreposto por cima — não fica dentro do botão.
      expect(button.querySelector('app-badge')).toBeNull();
    });

    it('renders the (decorative) badge as a sibling of the button, not nested inside it', () => {
      fixture.componentRef.setInput('editable', true);
      fixture.detectChanges();

      const badge = fixture.debugElement.query(By.directive(BadgeComponent));

      expect(badge).toBeTruthy();
      expect(badge.nativeElement.closest('button.avatar__edit-trigger')).toBeNull();
    });

    it('badge has pointer-events: none so clicks pass through to the button beneath it', () => {
      fixture.componentRef.setInput('editable', true);
      attachToDom();
      fixture.detectChanges();

      const badge = avatarEl().querySelector('.avatar__edit-badge') as HTMLElement;

      expect(getComputedStyle(badge).pointerEvents).toBe('none');
    });

    it('renders an image inside the button when type="photo" (the whole circle is clickable)', () => {
      fixture.componentRef.setInput('type', 'photo');
      fixture.componentRef.setInput('imageUrl', 'https://example.com/photo.jpg');
      fixture.componentRef.setInput('editable', true);
      fixture.detectChanges();

      const button = avatarEl().querySelector('button.avatar__edit-trigger') as HTMLButtonElement;

      expect(button.querySelector('img.avatar__image')).toBeTruthy();
    });

    it('exposes an accessible name via aria-label (default "Editar foto")', () => {
      fixture.componentRef.setInput('editable', true);
      fixture.detectChanges();

      const button = avatarEl().querySelector('button.avatar__edit-trigger');

      expect(button?.getAttribute('aria-label')).toBe('Editar foto');
    });

    it('accepts a custom editAriaLabel', () => {
      fixture.componentRef.setInput('editable', true);
      fixture.componentRef.setInput('editAriaLabel', 'Alterar foto do paciente');
      fixture.detectChanges();

      const button = avatarEl().querySelector('button.avatar__edit-trigger');

      expect(button?.getAttribute('aria-label')).toBe('Alterar foto do paciente');
    });

    it('emits editPhoto when the button (whole avatar circumference) is clicked', () => {
      fixture.componentRef.setInput('editable', true);
      fixture.detectChanges();

      const editPhoto = jasmine.createSpy('editPhoto');

      fixture.componentInstance.editPhoto.subscribe(editPhoto);

      const button = avatarEl().querySelector('button.avatar__edit-trigger') as HTMLButtonElement;

      button.click();

      expect(editPhoto).toHaveBeenCalledTimes(1);
    });

    it('is not rendered at all in size="small" (no button, no badge)', () => {
      fixture.componentRef.setInput('size', 'small');
      fixture.componentRef.setInput('editable', true);
      fixture.detectChanges();

      expect(avatarEl().querySelector('button.avatar__edit-trigger')).toBeNull();
      expect(fixture.debugElement.query(By.directive(BadgeComponent))).toBeNull();
    });
  });

  it('does not clip the edit badge — host overflow is visible, only .avatar__content clips (user request 2026-07-24)', () => {
    fixture.componentRef.setInput('type', 'photo');
    fixture.componentRef.setInput('imageUrl', 'https://example.com/photo.jpg');
    attachToDom();
    fixture.detectChanges();

    expect(getComputedStyle(avatarEl()).overflow).toBe('visible');

    const content = avatarEl().querySelector('.avatar__content') as HTMLElement;

    expect(getComputedStyle(content).overflow).toBe('hidden');
  });

  it('has border-radius: var(--radius-pill) in every size', () => {
    for (const size of ['small', 'default', 'big'] as const) {
      fixture.componentRef.setInput('size', size);
      attachToDom();
      fixture.detectChanges();

      expect(getComputedStyle(avatarEl()).borderRadius).toBe('400px');
    }
  });
});
