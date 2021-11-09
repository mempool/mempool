import { Component, OnInit, ElementRef, Input, AfterViewInit } from '@angular/core';
import * as confetti from 'canvas-confetti';

export type Options = confetti.Options;

@Component({
    selector: 'app-confetti',
    template: `
        <canvas
            inViewport
            [inViewportOptions]="{ threshold: [0], partial: true }"
            (inViewportAction)="setItemVisibility($event)"
            *ngIf="visible || stopped"
            [id]="canvasId"
        >
            <ng-content></ng-content>
        </canvas>
    `,
    styles: ['canvas { position: absolute; width: 100%; height: 100%; z-index: -1; }', 'div { height: 100%}']
})
export class ConfettiComponent implements AfterViewInit, OnInit {

  @Input() interval: number = 2000;
  @Input() options: Options;
  @Input() useWorker: boolean;

  confetti: (options?: confetti.Options) => Promise<null>;
  timer: number;
  visible: boolean;
  canvasId: string;
  canvas: HTMLCanvasElement;
  stopped = true;
  inViewportOptions: { threshold: [0], partial: true };

  constructor(private elementRef: ElementRef) {}

  ngOnInit() {
    this.canvasId = `canvasRef${Math.random()
      .toString()
      .slice(0, 6)
      .replace('.', '')}`;
  }

  ngAfterViewInit(): void {}

  setItemVisibility({ target, visible }: { target: Element; visible: boolean }): void {
    this.visible = visible;

    setTimeout(() => {
      if (visible) {
        this.canvas = this.elementRef.nativeElement.querySelector(`#${this.canvasId}`) as HTMLCanvasElement;
        if (!this.canvas) {
          return;
        }
        this.confetti = confetti.create(this.canvas, {
          resize: true,
          useWorker: this.useWorker
        });

        this.fire();
        if (this.interval > 0) {
          this.start();
        }
      } else {
        setTimeout(() => this.stop(), 1000);
      }
    }, 100);
  }

  start() {
    this.stopped = false;
    this.timer = window.setInterval(() => this.fire(), this.interval);
  }

  stop() {
    this.stopped = true;
    window.clearInterval(this.timer);
  }

  fire() {
    this.confetti(this.options);
  }
}
