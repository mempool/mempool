import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { Subscription, tap, timer } from 'rxjs';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-clock-face',
  templateUrl: './clock-face.component.html',
  styleUrls: ['./clock-face.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClockFaceComponent implements OnInit, OnChanges, OnDestroy {
  @Input() size: number = 300;

  blocksSubscription: Subscription;
  timeSubscription: Subscription;

  faceStyle;
  dialPath;
  blockTimes = [];
  segments = [];
  hours: number = 0;
  minutes: number = 0;
  minorTicks: number[] = [];
  majorTicks: number[] = [];

  constructor(
    public stateService: StateService,
    private cd: ChangeDetectorRef
  ) {
    this.updateTime();
    this.makeTicks();
  }

  ngOnInit(): void {
    if (this.stateService.isBrowser) {
      this.timeSubscription = timer(0, 250).pipe(
        tap(() => {
          console.log('face tick');
          this.updateTime();
        })
      ).subscribe();
      this.blocksSubscription = this.stateService.blocks$
        .subscribe((blocks) => {
          this.blockTimes = blocks.map(block => [block.height, new Date(block.timestamp * 1000)]);
          this.blockTimes = this.blockTimes.sort((a, b) => a[1].getTime() - b[1].getTime());
          this.updateSegments();
        });
    }
  }

  ngOnChanges(): void {
    this.faceStyle = {
      width: `${this.size}px`,
      height: `${this.size}px`,
    };
  }

  ngOnDestroy(): void {
    if (this.timeSubscription) {
      this.timeSubscription.unsubscribe();
    }
  }

  updateTime(): void {
    const now = new Date();
    const seconds = now.getSeconds() + (now.getMilliseconds() / 1000);
    this.minutes = (now.getMinutes() + (seconds / 60)) % 60;
    this.hours = now.getHours() + (this.minutes / 60);
    this.updateSegments();
  }

  updateSegments(): void {
    const now = new Date();
    this.blockTimes = this.blockTimes.filter(time => (now.getTime() - time[1].getTime()) <= 3600000);
    const tail = new Date(now.getTime() - 3600000);
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

    const times = [
      ['start', tail],
      ...this.blockTimes,
      ['end', now],
    ];
    const minuteTimes = times.map(time => {
      return [time[0], (time[1].getTime() - hourStart.getTime()) / 60000];
    });
    this.segments = [];
    const r = 174;
    const cx = 192;
    const cy = cx;
    for (let i = 1; i < minuteTimes.length; i++) {
      const arc = this.getArc(minuteTimes[i-1][1], minuteTimes[i][1], r, cx, cy);
      if (arc) {
        arc.id = minuteTimes[i][0];
        this.segments.push(arc);
      }
    }
    const arc = this.getArc(minuteTimes[0][1], minuteTimes[1][1], r, cx, cy);
    if (arc) {
      this.dialPath = arc.path;
    }

    this.cd.markForCheck();
  }

  getArc(startTime, endTime, r, cx, cy): any {
    const startDegrees = (startTime + 0.2) * 6;
      const endDegrees = (endTime - 0.2) * 6;
      const start = this.getPointOnCircle(startDegrees, r, cx, cy);
      const end = this.getPointOnCircle(endDegrees, r, cx, cy);
      const arcLength = endDegrees - startDegrees;
      // merge gaps and omit lines shorter than 1 degree
      if (arcLength >= 1) {
        const path = `M ${start.x} ${start.y} A ${r} ${r} 0 ${arcLength > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
        return {
          path,
          start,
          end
        };
      } else {
        return null;
      }
  }

  getPointOnCircle(deg, r, cx, cy) {
    const modDeg = ((deg % 360) + 360) % 360;
    const rad = (modDeg * Math.PI) / 180;
    return {
      x: cx + (r * Math.sin(rad)),
      y: cy - (r * Math.cos(rad)),
    };
  }

  makeTicks() {
    this.minorTicks = [];
    this.majorTicks = [];
    for (let i = 1; i < 60; i++) {
      if (i % 5 === 0) {
        this.majorTicks.push(i * 6);
      } else {
        this.minorTicks.push(i * 6);
      }
    }
  }

  trackBySegment(index: number, segment) {
    return segment.id;
  }
}
