import { Component, Input, Output, ChangeDetectionStrategy, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-toggle',
  templateUrl: './toggle.component.html',
  styleUrls: ['./toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleComponent {
  @Output() toggleStatusChanged = new EventEmitter<boolean>();
  @Input() textLeft: string;
  @Input() textRight: string;

  onToggleStatusChanged(e): void {
    this.toggleStatusChanged.emit(e.target.checked);
  }
}
