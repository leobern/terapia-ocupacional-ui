import { TestBed } from '@angular/core/testing';

import { AiAssistantService } from './ai-assistant.service';

describe('AiAssistantService', () => {
  function createService(): AiAssistantService {
    return TestBed.inject(AiAssistantService);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('inicia fechado', () => {
    expect(createService().isOpen()).toBeFalse();
  });

  it('abre o painel', () => {
    const service = createService();

    service.openPanel();

    expect(service.isOpen()).toBeTrue();
  });

  it('fecha o painel', () => {
    const service = createService();

    service.openPanel();
    service.closePanel();

    expect(service.isOpen()).toBeFalse();
  });

  it('é o mesmo estado para todo injetor (providedIn: root) — shell e telas compartilham o mesmo painel', () => {
    const first = createService();
    const second = TestBed.inject(AiAssistantService);

    first.openPanel();

    expect(second.isOpen()).toBeTrue();
  });
});
