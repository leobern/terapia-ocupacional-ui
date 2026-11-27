import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BannerComponent, type BannerType } from './banner.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BannerComponent],
  template: `<app-banner [type]="type()" [icon]="icon()">Aviso de teste</app-banner>`,
})
class HostComponent {
  readonly type = signal<BannerType>('info');
  readonly icon = signal<string | null>(null);
}

describe('BannerComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let banner: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    banner = fixture.nativeElement.querySelector('app-banner') as HTMLElement;
  });

  const iconClass = (): string => banner.querySelector('ph-icon i')?.className ?? '';

  it('mostra o texto projetado', () => {
    expect(banner.textContent).toContain('Aviso de teste');
  });

  it('info usa o ícone de check e anuncia como status', () => {
    expect(banner.classList).toContain('banner--info');
    expect(banner.getAttribute('role')).toBe('status');
    expect(iconClass()).toContain('check-circle');
  });

  it('warning usa o ícone de alerta e anuncia como alerta', () => {
    host.type.set('warning');
    fixture.detectChanges();

    expect(banner.classList).toContain('banner--warning');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(iconClass()).toContain('warning-diamond');
  });

  it('aceita trocar o ícone em qualquer tipo', () => {
    host.icon.set('wifi-x');
    fixture.detectChanges();

    expect(iconClass()).toContain('wifi-x');
    host.type.set('warning');
    fixture.detectChanges();

    expect(iconClass()).toContain('wifi-x');
  });
});
