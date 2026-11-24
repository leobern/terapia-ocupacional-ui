import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { TypewriterComponent } from './typewriter.component';

describe('TypewriterComponent', () => {
  let fixture: ComponentFixture<TypewriterComponent>;
  let finished: number;
  const live = (): string => fixture.nativeElement.querySelector('.typewriter__live').textContent ?? '';
  const ghost = (): string => fixture.nativeElement.querySelector('.typewriter__ghost').textContent ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TypewriterComponent] }).compileComponents();
    fixture = TestBed.createComponent(TypewriterComponent);
    finished = 0;
    fixture.componentInstance.finished.subscribe(() => finished++);
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    jasmine.clock().install();
  });

  afterEach(() => jasmine.clock().uninstall());

  const tick = (ms: number): void => {
    jasmine.clock().tick(ms);
    fixture.detectChanges();
  };

  it('escreve um caractere por tick e avisa ao terminar; o texto inteiro reserva o espaço', () => {
    fixture.componentRef.setInput('text', 'Olá');
    fixture.componentRef.setInput('speedMs', 10);
    fixture.detectChanges();

    expect(live()).toBe('');
    expect(ghost()).toBe('Olá');

    tick(10);

    expect(live()).toBe('O');

    tick(20);

    expect(live()).toBe('Olá');
    expect(finished).toBe(1);
  });

  it('desabilitado não escreve nada; ao habilitar começa a digitar', () => {
    fixture.componentRef.setInput('text', 'Oi');
    fixture.componentRef.setInput('enabled', false);
    fixture.componentRef.setInput('speedMs', 10);
    fixture.detectChanges();
    tick(50);

    expect(live()).toBe('');

    fixture.componentRef.setInput('enabled', true);
    fixture.detectChanges();
    tick(20);

    expect(live()).toBe('Oi');
  });

  it('restartKey reinicia a digitação do começo', () => {
    fixture.componentRef.setInput('text', 'Abc');
    fixture.componentRef.setInput('speedMs', 10);
    fixture.componentRef.setInput('restartKey', 1);
    fixture.detectChanges();
    tick(30);

    expect(live()).toBe('Abc');

    fixture.componentRef.setInput('restartKey', 2);
    fixture.detectChanges();

    expect(live()).toBe('');

    tick(30);

    expect(live()).toBe('Abc');
    expect(finished).toBe(2);
  });

  it('texto vazio termina na hora', () => {
    fixture.componentRef.setInput('text', '');
    fixture.detectChanges();

    expect(finished).toBe(1);
  });

  it('com movimento reduzido mostra o texto inteiro de uma vez', () => {
    (window.matchMedia as jasmine.Spy).and.returnValue({ matches: true } as MediaQueryList);
    fixture.componentRef.setInput('text', 'Olá mundo');
    fixture.detectChanges();

    expect(live()).toBe('Olá mundo');
    expect(finished).toBe(1);
  });
});
