import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { HorizontalnavbarComponent } from './horizontalnavbar.component';

describe('HorizontalnavbarComponent', () => {
  let component: HorizontalnavbarComponent;
  let fixture: ComponentFixture<HorizontalnavbarComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ HorizontalnavbarComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HorizontalnavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
