import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-channel-box',
  templateUrl: './channel-box.component.html',
  styleUrls: ['./channel-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelBoxComponent {
  @Input() channel: any;

  constructor() { }

}
