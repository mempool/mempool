import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelBoxComponent } from '@components/channel-box.component';

describe('ChannelBoxComponent', () => {
  let component: ChannelBoxComponent;
  let fixture: ComponentFixture<ChannelBoxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ChannelBoxComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChannelBoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
