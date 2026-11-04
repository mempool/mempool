import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ScanProgress } from '@app/watch/services/wallet-scanner.service';

@Component({
  selector: 'app-watch-scan-status',
  templateUrl: './watch-scan-status.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class WatchScanStatusComponent {
  @Input({ required: true }) progress!: ScanProgress;
  // False when refreshing a wallet on screen, whose figures the running totals would contradict.
  @Input() showCounts = true;
}
