import { Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-clock-face',
  templateUrl: './clock-face.component.html',
  styleUrls: ['./clock-face.component.scss'],
})
export class ClockFaceComponent implements OnChanges {
  @Input() size: number = 300;
  faceStyle;

  constructor() {}

  ngOnChanges(): void {
    this.faceStyle = {
      width: `${this.size}px`,
      height: `${this.size}px`,
    };
  }
}
