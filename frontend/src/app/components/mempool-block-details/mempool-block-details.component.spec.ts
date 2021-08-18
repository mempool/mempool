import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MempoolBlockDetailsComponent } from './mempool-block-details.component';

describe('MempoolBlockDetailsComponent', () => {
  let component: MempoolBlockDetailsComponent;
  let fixture: ComponentFixture<MempoolBlockDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MempoolBlockDetailsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MempoolBlockDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
