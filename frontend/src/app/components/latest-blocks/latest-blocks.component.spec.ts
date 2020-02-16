import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LatestBlocksComponent } from './latest-blocks.component';

describe('LatestBlocksComponent', () => {
  let component: LatestBlocksComponent;
  let fixture: ComponentFixture<LatestBlocksComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ LatestBlocksComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LatestBlocksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
