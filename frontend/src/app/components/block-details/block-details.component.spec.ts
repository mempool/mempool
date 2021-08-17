import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlockDetailsComponent } from './block-details.component';

describe('BlockDetailsComponent', () => {
  let component: BlockDetailsComponent;
  let fixture: ComponentFixture<BlockDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BlockDetailsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BlockDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
