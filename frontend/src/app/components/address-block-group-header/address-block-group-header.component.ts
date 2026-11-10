import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';
import { AddressBlockGroup } from '@components/address-blocks/address-blocks.utils';

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

  @HostBinding('attr.data-block-group')
  get groupId(): string {
    return this.group?.id;
  }
}
