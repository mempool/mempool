import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VbytesPipe } from './pipes/bytes-pipe/vbytes.pipe';
import { ShortenStringPipe } from './pipes/shorten-string-pipe/shorten-string.pipe';
import { CeilPipe } from './pipes/math-ceil/math-ceil.pipe';
import { Hex2asciiPipe } from './pipes/hex2ascii/hex2ascii.pipe';
import { RelativeUrlPipe } from './pipes/relative-url/relative-url.pipe';
import { ScriptpubkeyTypePipe } from './pipes/scriptpubkey-type-pipe/scriptpubkey-type.pipe';
import { BytesPipe } from './pipes/bytes-pipe/bytes.pipe';
import { WuBytesPipe } from './pipes/bytes-pipe/wubytes.pipe';
import { TimeSinceComponent } from '../components/time-since/time-since.component';
import { ClipboardComponent } from '../components/clipboard/clipboard.component';
import { QrcodeComponent } from '../components/qrcode/qrcode.component';
import { FiatComponent } from '../fiat/fiat.component';
import { NgbNavModule, NgbTooltipModule, NgbButtonsModule, NgbPaginationModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TxFeaturesComponent } from '../components/tx-features/tx-features.component';
import { TxFeeRatingComponent } from '../components/tx-fee-rating/tx-fee-rating.component';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    ClipboardComponent,
    TimeSinceComponent,
    QrcodeComponent,
    FiatComponent,
    TxFeaturesComponent,
    TxFeeRatingComponent,
    ScriptpubkeyTypePipe,
    RelativeUrlPipe,
    Hex2asciiPipe,
    BytesPipe,
    VbytesPipe,
    WuBytesPipe,
    CeilPipe,
    ShortenStringPipe,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgbNavModule,
    NgbTooltipModule,
    NgbButtonsModule,
    NgbPaginationModule,
    NgbDropdownModule,
  ],
  providers: [
    VbytesPipe,
  ],
  exports: [
    NgbNavModule,
    CommonModule,
    ReactiveFormsModule,
    NgbTooltipModule,
    NgbButtonsModule,
    NgbPaginationModule,
    NgbDropdownModule,
    TimeSinceComponent,
    ClipboardComponent,
    QrcodeComponent,
    FiatComponent,
    TxFeaturesComponent,
    TxFeeRatingComponent,
    ScriptpubkeyTypePipe,
    RelativeUrlPipe,
    Hex2asciiPipe,
    BytesPipe,
    VbytesPipe,
    WuBytesPipe,
    CeilPipe,
    ShortenStringPipe,
  ]
})
export class SharedModule {}
