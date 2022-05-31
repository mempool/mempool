import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-svg-images',
  templateUrl: './svg-images.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvgImagesComponent {
  @Input() name: string;
  @Input() class: string;
  @Input() style: string;
  @Input() width: string;
  @Input() height: string;
  @Input() viewBox: string;
}
