import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DripiconsComponent } from './dripicons.component';

describe('DripiconsComponent', () => {
  let component: DripiconsComponent;
  let fixture: ComponentFixture<DripiconsComponent>;

  beforeEach(async(() => {
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
