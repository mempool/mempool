import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BisqBlockComponent } from './bisq-block.component';

describe('BisqBlockComponent', () => {
  let component: BisqBlockComponent;
  let fixture: ComponentFixture<BisqBlockComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BisqBlockComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BisqBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
