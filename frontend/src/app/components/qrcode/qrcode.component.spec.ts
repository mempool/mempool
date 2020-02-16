import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { QrcodeComponent } from './qrcode.component';

describe('QrcodeComponent', () => {
  let component: QrcodeComponent;
  let fixture: ComponentFixture<QrcodeComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ QrcodeComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(QrcodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
