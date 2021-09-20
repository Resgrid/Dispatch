import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MaterialdesignComponent } from './materialdesign.component';

describe('MaterialdesignComponent', () => {
  let component: MaterialdesignComponent;
  let fixture: ComponentFixture<MaterialdesignComponent>;

  beforeEach(async(() => {
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
