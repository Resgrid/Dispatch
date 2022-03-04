import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RightsidebarComponent } from './rightsidebar.component';

describe('RightsidebarComponent', () => {
  let component: RightsidebarComponent;
  let fixture: ComponentFixture<RightsidebarComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ RightsidebarComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RightsidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
