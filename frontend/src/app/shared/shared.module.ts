import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VbytesPipe } from './pipes/bytes-pipe/vbytes.pipe';
import { ShortenStringPipe } from './pipes/shorten-string-pipe/shorten-string.pipe';
import { CeilPipe } from './pipes/math-ceil/math-ceil.pipe';
import { Hex2asciiPipe } from './pipes/hex2ascii/hex2ascii.pipe';
import { Decimal2HexPipe } from './pipes/decimal2hex/decimal2hex.pipe';
import { FeeRoundingPipe } from './pipes/fee-rounding/fee-rounding.pipe';
import { AsmStylerPipe } from './pipes/asm-styler/asm-styler.pipe';
import { AbsolutePipe } from './pipes/absolute/absolute.pipe';
import { RelativeUrlPipe } from './pipes/relative-url/relative-url.pipe';
import { ScriptpubkeyTypePipe } from './pipes/scriptpubkey-type-pipe/scriptpubkey-type.pipe';
import { BytesPipe } from './pipes/bytes-pipe/bytes.pipe';
import { WuBytesPipe } from './pipes/bytes-pipe/wubytes.pipe';
import { BlockchainComponent } from '../components/blockchain/blockchain.component';
import { TimeSinceComponent } from '../components/time-since/time-since.component';
import { TimeUntilComponent } from '../components/time-until/time-until.component';
import { ClipboardComponent } from '../components/clipboard/clipboard.component';
import { QrcodeComponent } from '../components/qrcode/qrcode.component';
import { FiatComponent } from '../fiat/fiat.component';
import { NgbNavModule, NgbTooltipModule, NgbButtonsModule, NgbPaginationModule, NgbDropdownModule, NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';
import { TxFeaturesComponent } from '../components/tx-features/tx-features.component';
import { TxFeeRatingComponent } from '../components/tx-fee-rating/tx-fee-rating.component';
import { ReactiveFormsModule } from '@angular/forms';
import { LanguageSelectorComponent } from '../components/language-selector/language-selector.component';
import { ColoredPriceDirective } from './directives/colored-price.directive';
import { NoSanitizePipe } from './pipes/no-sanitize.pipe';
import { MempoolBlocksComponent } from '../components/mempool-blocks/mempool-blocks.component';
import { BlockchainBlocksComponent } from '../components/blockchain-blocks/blockchain-blocks.component';
import { AmountComponent } from '../components/amount/amount.component';
import { RouterModule } from '@angular/router';
import { CapAddressPipe } from './pipes/cap-address-pipe/cap-address-pipe';

@NgModule({
  declarations: [
    ClipboardComponent,
    TimeSinceComponent,
    TimeUntilComponent,
    QrcodeComponent,
    FiatComponent,
    TxFeaturesComponent,
    TxFeeRatingComponent,
    LanguageSelectorComponent,
    ScriptpubkeyTypePipe,
    RelativeUrlPipe,
    NoSanitizePipe,
    Hex2asciiPipe,
    AsmStylerPipe,
    AbsolutePipe,
    BytesPipe,
    VbytesPipe,
    WuBytesPipe,
    CeilPipe,
    ShortenStringPipe,
    CapAddressPipe,
    Decimal2HexPipe,
    FeeRoundingPipe,
    ColoredPriceDirective,
    BlockchainComponent,
    MempoolBlocksComponent,
    BlockchainBlocksComponent,
    AmountComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    NgbNavModule,
    NgbTooltipModule,
    NgbButtonsModule,
    NgbPaginationModule,
    NgbDropdownModule,
    NgbAccordionModule,
  ],
  providers: [
    VbytesPipe,
    RelativeUrlPipe,
    NoSanitizePipe,
  ],
  exports: [
    RouterModule,
    NgbAccordionModule,
    NgbNavModule,
    CommonModule,
    ReactiveFormsModule,
    NgbTooltipModule,
    NgbButtonsModule,
    NgbPaginationModule,
    NgbDropdownModule,
    TimeSinceComponent,
    TimeUntilComponent,
    ClipboardComponent,
    QrcodeComponent,
    FiatComponent,
    TxFeaturesComponent,
    TxFeeRatingComponent,
    LanguageSelectorComponent,
    ScriptpubkeyTypePipe,
    RelativeUrlPipe,
    Hex2asciiPipe,
    AsmStylerPipe,
    AbsolutePipe,
    BytesPipe,
    VbytesPipe,
    WuBytesPipe,
    CeilPipe,
    ShortenStringPipe,
    CapAddressPipe,
    Decimal2HexPipe,
    FeeRoundingPipe,
    ColoredPriceDirective,
    NoSanitizePipe,
    BlockchainComponent,
    MempoolBlocksComponent,
    BlockchainBlocksComponent,
    AmountComponent,
  ]
})
export class SharedModule {}
