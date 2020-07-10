import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BisqTransactionComponent } from './bisq-transaction.component';

describe('BisqTransactionComponent', () => {
  let component: BisqTransactionComponent;
  let fixture: ComponentFixture<BisqTransactionComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BisqTransactionComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BisqTransactionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
