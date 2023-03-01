import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit } from '@angular/core';

@Component({
  selector: 'app-closing-type',
  templateUrl: './closing-type.component.html',
  styleUrls: ['./closing-type.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClosingTypeComponent implements OnChanges {
  @Input() type = 0;
  label: { label: string; class: string };

  ngOnChanges() {
    this.label = this.getLabelFromType(this.type);
  }

  getLabelFromType(type: number): { label: string; class: string } {
    switch (type) {
      case 1: return { 
        label: $localize`Mutually closed`,
        class: 'success',
      };
      case 2: return {
        label: $localize`Force closed`,
        class: 'warning',
      };
      case 3: return {
        label: $localize`Force closed with penalty`,
        class: 'danger',
      };
      default: return {
        label: $localize`:@@e5d8bb389c702588877f039d72178f219453a72d:Unknown`,
        class: 'secondary',
      };
    }
  }
}
