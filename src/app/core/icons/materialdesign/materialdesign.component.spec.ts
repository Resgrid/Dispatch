import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { MaterialdesignComponent } from './materialdesign.component';

describe('MaterialdesignComponent', () => {
  let component: MaterialdesignComponent;
  let fixture: ComponentFixture<MaterialdesignComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ MaterialdesignComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MaterialdesignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
