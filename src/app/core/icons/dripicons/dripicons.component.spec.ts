import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DripiconsComponent } from './dripicons.component';

describe('DripiconsComponent', () => {
  let component: DripiconsComponent;
  let fixture: ComponentFixture<DripiconsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ DripiconsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DripiconsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
