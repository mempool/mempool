import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelCloseBoxComponent } from '@components/channel-close-box.component';

describe('ChannelCloseBoxComponent', () => {
  let component: ChannelCloseBoxComponent;
  let fixture: ComponentFixture<ChannelCloseBoxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ChannelCloseBoxComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChannelCloseBoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
