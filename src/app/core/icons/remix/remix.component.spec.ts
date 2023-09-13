import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";

import { RemixComponent } from "./remix.component";

describe("RemixComponent", () => {
  let component: RemixComponent;
  let fixture: ComponentFixture<RemixComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [RemixComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RemixComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
