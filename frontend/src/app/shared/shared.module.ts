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
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';

@NgModule({
  declarations: [
    ScriptpubkeyTypePipe,
    RelativeUrlPipe,
    Hex2asciiPipe,
    BytesPipe,
    VbytesPipe,
    WuBytesPipe,
    CeilPipe,
    ShortenStringPipe,
    ClipboardComponent,
    TimeSinceComponent,
    QrcodeComponent,
    FiatComponent,
  ],
  imports: [
    CommonModule,
    NgbNavModule,
  ],
  providers: [
    VbytesPipe,
  ],
  exports: [
    NgbNavModule,
    CommonModule,
    ScriptpubkeyTypePipe,
    RelativeUrlPipe,
    Hex2asciiPipe,
    BytesPipe,
    VbytesPipe,
    WuBytesPipe,
    CeilPipe,
    ShortenStringPipe,
    TimeSinceComponent,
    ClipboardComponent,
    QrcodeComponent,
    FiatComponent,
  ]
})
export class SharedModule {}
