import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';
import { AvatarComponent } from '../avatar/avatar.component';
import { TagComponent } from './tag.component';

describe('TagComponent', () => {
  let fixture: ComponentFixture<TagComponent>;

  // O host É a caixa visual da tag (sem `display: contents`, mesmo padrão de
  // app-badge/app-avatar) — as classes/estilos ficam no próprio elemento `<app-tag>`.
  function tagEl(): HTMLElement {
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
      imports: [TagComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TagComponent);
    fixture.detectChanges();
  });

  it('defaults to type="user"', () => {
    expect(tagEl().classList).toContain('tag--user');
  });

  describe('type="user"', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('type', 'user');
      fixture.componentRef.setInput('label', 'Dra. Michelle Franklin');
      fixture.componentRef.setInput('avatarSrc', 'https://example.com/foto.jpg');
      fixture.detectChanges();
    });

    it('renders app-avatar internally (size="small" type="photo")', () => {
      const avatar = fixture.debugElement.query(By.directive(AvatarComponent));

      expect(avatar).toBeTruthy();
      expect(avatar.componentInstance.size()).toBe('small');
      expect(avatar.componentInstance.type()).toBe('photo');
      expect(avatar.componentInstance.imageUrl()).toBe('https://example.com/foto.jpg');
    });

    it('renders the label text', () => {
      expect(tagEl().querySelector('.tag__label')?.textContent?.trim()).toBe('Dra. Michelle Franklin');
    });

    it('always uses a fixed background/border, regardless of any prop', () => {
      attachToDom();
      fixture.detectChanges();

      const cs = getComputedStyle(tagEl());

      expect(cs.backgroundColor).toBe('rgb(255, 255, 255)'); // --color-surface #FFFFFF
      expect(cs.borderColor).toBe('rgb(206, 221, 227)'); // --color-border-2 #CEDDE3
      expect(cs.borderWidth).toBe('1px');
    });

    it('renders a right icon with default name "arrows-clockwise" and default color content-3', () => {
      const icon = fixture.debugElement.query(By.directive(PhIconComponent));

      expect(icon).toBeTruthy();
      expect(icon.componentInstance.name()).toBe('arrows-clockwise');
      // Valor literal do binding — resolver a custom property em si depende do
      // stylesheet global (_tokens.scss), não carregado neste teste isolado.
      expect((icon.nativeElement as HTMLElement).style.color).toBe('var(--color-content-3)');
    });

    it('applies a custom iconRightName/iconRightColor', () => {
      fixture.componentRef.setInput('iconRightName', 'check');
      fixture.componentRef.setInput('iconRightColor', '#abcdef');
      fixture.detectChanges();

      const icon = fixture.debugElement.query(By.directive(PhIconComponent));

      expect(icon.componentInstance.name()).toBe('check');
      expect(getComputedStyle(icon.nativeElement).color).toBe('rgb(171, 205, 239)');
    });

    it('hides the right icon completely when iconRight=false', () => {
      fixture.componentRef.setInput('iconRight', false);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.directive(PhIconComponent))).toBeNull();
    });

    it('has border-radius: var(--radius-tag) (26px)', () => {
      attachToDom();
      fixture.detectChanges();

      expect(getComputedStyle(tagEl()).borderRadius).toBe('26px');
    });

    it('has a fixed height of 40px', () => {
      attachToDom();
      fixture.detectChanges();

      expect(tagEl().offsetHeight).toBe(40);
    });
  });

  describe('type="default"', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('type', 'default');
      fixture.componentRef.setInput('label', 'Hospital Vila Nova Star');
      fixture.detectChanges();
    });

    it('renders left and right icons with defaults "map-pin"/"caret-down"', () => {
      const icons = fixture.debugElement.queryAll(By.directive(PhIconComponent));

      expect(icons.length).toBe(2);
      expect(icons[0].componentInstance.name()).toBe('map-pin');
      expect(icons[1].componentInstance.name()).toBe('caret-down');
    });

    it('applies custom iconLeftName/iconLeftColor and iconRightName/iconRightColor independently', () => {
      fixture.componentRef.setInput('iconLeftName', 'building');
      fixture.componentRef.setInput('iconLeftColor', '#111111');
      fixture.componentRef.setInput('iconRightName', 'x');
      fixture.componentRef.setInput('iconRightColor', '#222222');
      fixture.detectChanges();

      const icons = fixture.debugElement.queryAll(By.directive(PhIconComponent));

      expect(icons[0].componentInstance.name()).toBe('building');
      expect(getComputedStyle(icons[0].nativeElement).color).toBe('rgb(17, 17, 17)');
      expect(icons[1].componentInstance.name()).toBe('x');
      expect(getComputedStyle(icons[1].nativeElement).color).toBe('rgb(34, 34, 34)');
    });

    it('hides left icon when iconLeft=false and right icon when iconRight=false, independently', () => {
      fixture.componentRef.setInput('iconLeft', false);
      fixture.detectChanges();

      expect(fixture.debugElement.queryAll(By.directive(PhIconComponent)).length).toBe(1);

      fixture.componentRef.setInput('iconRight', false);
      fixture.detectChanges();

      expect(fixture.debugElement.queryAll(By.directive(PhIconComponent)).length).toBe(0);
    });

    it('applies a custom backgroundColor via inline style', () => {
      fixture.componentRef.setInput('backgroundColor', '#abcdef');
      attachToDom();
      fixture.detectChanges();

      expect(getComputedStyle(tagEl()).backgroundColor).toBe('rgb(171, 205, 239)');
    });

    it('uses var(--color-tertiary) as the default background', () => {
      // Valor literal do binding — resolver a custom property em si depende do
      // stylesheet global (_tokens.scss), não carregado neste teste isolado.
      expect(tagEl().style.background).toBe('var(--color-tertiary)');
    });

    it('has max-width: var(--space-280) (280px) and truncates the label with ellipsis', () => {
      attachToDom();
      fixture.detectChanges();

      expect(getComputedStyle(tagEl()).maxWidth).toBe('280px');

      const label = tagEl().querySelector('.tag__label') as HTMLElement;
      const cs = getComputedStyle(label);

      expect(cs.textOverflow).toBe('ellipsis');
      expect(cs.whiteSpace).toBe('nowrap');
      expect(cs.overflow).toBe('hidden');
    });

    it('has border-radius: var(--radius-tag) (26px) and height 32px', () => {
      attachToDom();
      fixture.detectChanges();

      expect(getComputedStyle(tagEl()).borderRadius).toBe('26px');
      expect(tagEl().offsetHeight).toBe(32);
    });
  });

  describe('type="status"', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('type', 'status');
      fixture.componentRef.setInput('label', 'Ideal');
      fixture.detectChanges();
    });

    it('renders only the centered label, no icon', () => {
      expect(tagEl().querySelector('.tag__label')?.textContent?.trim()).toBe('Ideal');
      expect(fixture.debugElement.query(By.directive(PhIconComponent))).toBeNull();

      attachToDom();
      fixture.detectChanges();

      const label = tagEl().querySelector('.tag__label') as HTMLElement;

      expect(getComputedStyle(label).textAlign).toBe('center');
    });

    it('uses var(--color-comm-success) as the default background', () => {
      // Valor literal do binding — resolver a custom property em si depende do
      // stylesheet global (_tokens.scss), não carregado neste teste isolado.
      expect(tagEl().style.background).toBe('var(--color-comm-success)');
    });

    it('applies a custom backgroundColor via inline style', () => {
      fixture.componentRef.setInput('backgroundColor', '#ff00ff');
      attachToDom();
      fixture.detectChanges();

      expect(getComputedStyle(tagEl()).backgroundColor).toBe('rgb(255, 0, 255)');
    });

    it('has border-radius: var(--radius-md) (24px) and height 16px', () => {
      attachToDom();
      fixture.detectChanges();

      expect(getComputedStyle(tagEl()).borderRadius).toBe('24px');
      expect(tagEl().offsetHeight).toBe(16);
    });

    it('iconLeft/iconRight have no effect on this type', () => {
      fixture.componentRef.setInput('iconLeft', true);
      fixture.componentRef.setInput('iconRight', true);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.directive(PhIconComponent))).toBeNull();
    });
  });

  it('is never focusable or interactive, in any type (SC-004)', () => {
    for (const type of ['user', 'default', 'status'] as const) {
      fixture.componentRef.setInput('type', type);
      fixture.detectChanges();

      expect(tagEl().hasAttribute('tabindex')).toBeFalse();
      expect(tagEl().getAttribute('role')).not.toBe('button');
      expect(tagEl().tagName).not.toBe('BUTTON');
    }
  });
});
