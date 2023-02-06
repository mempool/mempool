import { Component, Input, Output, ChangeDetectionStrategy, EventEmitter, AfterViewInit, ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-toggle',
  templateUrl: './toggle.component.html',
  styleUrls: ['./toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleComponent implements AfterViewInit {
  @Output() toggleStatusChanged = new EventEmitter<boolean>();
  @Input() textLeft: string;
  @Input() textRight: string;
  @Input() checked: boolean = false;
  animate: boolean = false;

  constructor(
    private cd: ChangeDetectorRef,
  ) { }

  ngAfterViewInit(): void {
    this.animate = true;
    setTimeout(() => { this.cd.markForCheck()});
  }

  onToggleStatusChanged(e): void {
    this.toggleStatusChanged.emit(e.target.checked);
  }
}
