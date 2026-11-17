import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationSectionTitleComponent } from './notification-section-title.component';

describe('NotificationSectionTitleComponent', () => {
  let fixture: ComponentFixture<NotificationSectionTitleComponent>;

  it('renderiza o label recebido (FR-004a — único título visível da lista)', async () => {
    await TestBed.configureTestingModule({ imports: [NotificationSectionTitleComponent] }).compileComponents();
    fixture = TestBed.createComponent(NotificationSectionTitleComponent);
    fixture.componentRef.setInput('label', 'Resolvidas');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.notification-section-title').textContent).toContain('Resolvidas');
  });
});
