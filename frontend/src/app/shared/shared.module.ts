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
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { BisqIconComponent } from '../components/bisq-icon/bisq-icon.component';
import { faLeaf, faQuestion, faExclamationTriangle, faRocket, faRetweet, faFileAlt, faMoneyBill, faEye, faEyeSlash, faLock, faLockOpen } from '@fortawesome/free-solid-svg-icons';

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
    BisqIconComponent,
  ],
  imports: [
    CommonModule,
    FontAwesomeModule,
  ],
  providers: [
    VbytesPipe,
  ],
  exports: [
    ScriptpubkeyTypePipe,
    RelativeUrlPipe,
    Hex2asciiPipe,
    BytesPipe,
    VbytesPipe,
    WuBytesPipe,
    CeilPipe,
    ShortenStringPipe,
    BisqIconComponent,
  ]
})
export class SharedModule {
  constructor(library: FaIconLibrary) {
    library.addIcons(faQuestion);
    library.addIcons(faExclamationTriangle);
    library.addIcons(faRocket);
    library.addIcons(faRetweet);
    library.addIcons(faLeaf);
    library.addIcons(faFileAlt);
    library.addIcons(faMoneyBill);
    library.addIcons(faEye);
    library.addIcons(faEyeSlash);
    library.addIcons(faLock);
    library.addIcons(faLockOpen);
  }
}
