import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MempoolBlockComponent } from './mempool-block.component';

describe('MempoolBlockComponent', () => {
  let component: MempoolBlockComponent;
  let fixture: ComponentFixture<MempoolBlockComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [MempoolBlockComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MempoolBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
