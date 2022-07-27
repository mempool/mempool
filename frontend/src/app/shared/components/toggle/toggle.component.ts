import { Component, Input, Output, ChangeDetectionStrategy, EventEmitter, AfterViewInit } from '@angular/core';

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

  ngAfterViewInit(): void {
    this.toggleStatusChanged.emit(false);
  }

  onToggleStatusChanged(e): void {
    this.toggleStatusChanged.emit(e.target.checked);
  }
}
