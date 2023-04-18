import { Component, HostListener, OnInit } from '@angular/core';

@Component({
  selector: 'app-clock-face',
  templateUrl: './clock-face.component.html',
  styleUrls: ['./clock-face.component.scss'],
})
export class ClockFaceComponent implements OnInit {
  size: number;
  wrapperStyle;
  chainStyle;
  faceStyle;
  showDial: boolean = false;

  constructor() {}

  ngOnInit(): void {
    // initialize stuff
    this.resizeCanvas();
  }

  @HostListener('window:resize', ['$event'])
  resizeCanvas(): void {
    this.size = Math.min(window.innerWidth, 0.78125 * window.innerHeight);
    this.wrapperStyle = {
      '--clock-width': `${this.size}px`
    };
    const scaleFactor = window.innerWidth / 1390;
    this.chainStyle = {
      transform: `translate(2vw, 0.5vw) scale(${scaleFactor})`,
      transformOrigin: 'top left',
    };

    this.faceStyle = {
      width: `${this.size}px`,
      height: `${this.size}px`,
    };
  }
}
