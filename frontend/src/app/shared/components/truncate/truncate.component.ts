import { Component, Input, Inject, LOCALE_ID, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { AddressFormattingService } from '@app/services/address-formatting.service';
import { Subscription } from 'rxjs';
@Component({
  selector: 'app-truncate',
  templateUrl: './truncate.component.html',
  styleUrls: ['./truncate.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TruncateComponent {
  @Input() text: string;
  @Input() link: any = null;
  @Input() external: boolean = false;
  @Input() queryParams: any = undefined;
  @Input() lastChars: number = 4;
  @Input() maxWidth: number = null;
  @Input() inline: boolean = false;
  @Input() textAlign: 'start' | 'end' = 'start';
  @Input() disabled: boolean = false;
  rtl: boolean;
  private formattingStateSubscription: Subscription;

  constructor(
    @Inject(LOCALE_ID) private locale: string,
    public formattingService: AddressFormattingService,
    private cd: ChangeDetectorRef
  ) {
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.rtl = true;
    }
  }

  ngOnInit() {
    this.formattingStateSubscription = this.formattingService.mode$.subscribe(() => {
      this.cd.markForCheck();
    });
  }

  ngOnDestroy() {
    if (this.formattingStateSubscription) {
      this.formattingStateSubscription.unsubscribe();
    }
  }
}
