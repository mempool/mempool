import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AddressLabelsComponent } from './address-labels.component';

describe('AddressLabelsComponent', () => {
  let component: AddressLabelsComponent;
  let fixture: ComponentFixture<AddressLabelsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [AddressLabelsComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AddressLabelsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
