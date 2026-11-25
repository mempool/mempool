import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';
import { AddressBlockGroup, minedBlockBackground, pendingBlockBackground } from '@components/address-blocks/address-blocks.utils';
import { StateService } from '@app/services/state.service';
import { ThemeService } from '@app/services/theme.service';

@Component({
  selector: 'app-address-block-group-header',
  templateUrl: './address-block-group-header.component.html',
  styleUrls: ['./address-block-group-header.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressBlockGroupHeaderComponent {
  @Input() group: AddressBlockGroup;
  @HostBinding('class.first-group') @Input() first = false;
  @HostBinding('attr.tabindex') tabindex = -1;

  constructor(
    private stateService: StateService,
    private themeService: ThemeService,
  ) {}

  @HostBinding('attr.data-block-group')
  get groupId(): string {
    return this.group?.id;
  }

  get cubeBackground(): string {
    return this.group.status.confirmed
      ? minedBlockBackground(this.stateService.network)
      : pendingBlockBackground(this.group.feeRates, this.themeService.mempoolFeeColors);
  }
}
