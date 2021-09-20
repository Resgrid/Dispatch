import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RemixComponent } from './remix.component';

describe('RemixComponent', () => {
  let component: RemixComponent;
  let fixture: ComponentFixture<RemixComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RemixComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RemixComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
