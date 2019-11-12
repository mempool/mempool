import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbButtonsModule, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';

import { BytesPipe } from './pipes/bytes-pipe/bytes.pipe';
import { VbytesPipe } from './pipes/bytes-pipe/vbytes.pipe';
import { RoundPipe } from './pipes/math-round-pipe/math-round.pipe';
import { CeilPipe } from './pipes/math-ceil/math-ceil.pipe';
import { ChartistComponent } from '../statistics/chartist.component';
import { TimeSincePipe } from './pipes/time-since/time-since.pipe';
import { WuBytesPipe } from './pipes/bytes-pipe/wubytes.pipe';
import { ShortenStringPipe } from './pipes/shorten-string-pipe/shorten-string.pipe';

@NgModule({
  imports: [
    CommonModule,
    NgbButtonsModule,
    NgbModalModule,
  ],
  declarations: [
    ChartistComponent,
    RoundPipe,
    CeilPipe,
    BytesPipe,
    VbytesPipe,
    WuBytesPipe,
    ShortenStringPipe,
    TimeSincePipe,
  ],
  exports: [
    RoundPipe,
    CeilPipe,
    BytesPipe,
    VbytesPipe,
    WuBytesPipe,
    TimeSincePipe,
    ShortenStringPipe,
    NgbButtonsModule,
    NgbModalModule,
    ChartistComponent,
  ],
  providers: [
    BytesPipe,
    VbytesPipe,
    WuBytesPipe,
    ShortenStringPipe,
  ]
})
export class SharedModule { }
