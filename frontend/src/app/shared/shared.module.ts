import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbCollapse, NgbCollapseModule, NgbRadioGroup, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faFilter, faAngleDown, faAngleUp, faAngleRight, faAngleLeft, faBolt, faChartArea, faCogs, faCubes, faHammer, faDatabase, faExchangeAlt, faInfoCircle,
  faLink, faList, faSearch, faCaretUp, faCaretDown, faTachometerAlt, faThList, faTint, faTv, faAngleDoubleDown, faSortUp, faAngleDoubleUp, faChevronDown,
  faFileAlt, faRedoAlt, faArrowAltCircleRight, faExternalLinkAlt, faBook, faListUl, faDownload, faQrcode } from '@fortawesome/free-solid-svg-icons';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { MasterPageComponent } from '../components/master-page/master-page.component';
import { MasterPagePreviewComponent } from '../components/master-page-preview/master-page-preview.component';
import { BisqMasterPageComponent } from '../components/bisq-master-page/bisq-master-page.component';
import { LiquidMasterPageComponent } from '../components/liquid-master-page/liquid-master-page.component';
import { AboutComponent } from '../components/about/about.component';
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
import { StartComponent } from '../components/start/start.component';
import { TransactionComponent } from '../components/transaction/transaction.component';
import { TransactionsListComponent } from '../components/transactions-list/transactions-list.component';
import { BlockComponent } from '../components/block/block.component';
import { BlockPreviewComponent } from '../components/block/block-preview.component';
import { BlockAuditComponent } from '../components/block-audit/block-audit.component';
import { BlockOverviewGraphComponent } from '../components/block-overview-graph/block-overview-graph.component';
import { BlockOverviewTooltipComponent } from '../components/block-overview-tooltip/block-overview-tooltip.component';
import { AddressComponent } from '../components/address/address.component';
import { AddressPreviewComponent } from '../components/address/address-preview.component';
import { SearchFormComponent } from '../components/search-form/search-form.component';
import { AddressLabelsComponent } from '../components/address-labels/address-labels.component';
import { FooterComponent } from '../components/footer/footer.component';
import { TimeSpanComponent } from '../components/time-span/time-span.component';
import { AssetComponent } from '../components/asset/asset.component';
import { AssetsComponent } from '../components/assets/assets.component';
import { AssetsNavComponent } from '../components/assets/assets-nav/assets-nav.component';
import { StatusViewComponent } from '../components/status-view/status-view.component';
import { FeesBoxComponent } from '../components/fees-box/fees-box.component';
import { DifficultyComponent } from '../components/difficulty/difficulty.component';
import { TermsOfServiceComponent } from '../components/terms-of-service/terms-of-service.component';
import { PrivacyPolicyComponent } from '../components/privacy-policy/privacy-policy.component';
import { TrademarkPolicyComponent } from '../components/trademark-policy/trademark-policy.component';
import { SponsorComponent } from '../components/sponsor/sponsor.component';
import { PushTransactionComponent } from '../components/push-transaction/push-transaction.component';
import { AssetsFeaturedComponent } from '../components/assets/assets-featured/assets-featured.component';
import { AssetGroupComponent } from '../components/assets/asset-group/asset-group.component';
import { AssetCirculationComponent } from '../components/asset-circulation/asset-circulation.component';
import { AmountShortenerPipe } from '../shared/pipes/amount-shortener.pipe';
import { DifficultyAdjustmentsTable } from '../components/difficulty-adjustments-table/difficulty-adjustments-table.components';
import { BlocksList } from '../components/blocks-list/blocks-list.component';
import { RewardStatsComponent } from '../components/reward-stats/reward-stats.component';
import { DataCyDirective } from '../data-cy.directive';
import { LoadingIndicatorComponent } from '../components/loading-indicator/loading-indicator.component';
import { IndexingProgressComponent } from '../components/indexing-progress/indexing-progress.component';
import { SvgImagesComponent } from '../components/svg-images/svg-images.component';
import { ChangeComponent } from '../components/change/change.component';
import { SatsComponent } from './components/sats/sats.component';
import { SearchResultsComponent } from '../components/search-form/search-results/search-results.component';
import { TimestampComponent } from './components/timestamp/timestamp.component';

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
    AboutComponent,
    MasterPageComponent,
    MasterPagePreviewComponent,
    BisqMasterPageComponent,
    LiquidMasterPageComponent,
    StartComponent,
    TransactionComponent,
    BlockComponent,
    BlockPreviewComponent,
    BlockAuditComponent,
    BlockOverviewGraphComponent,
    BlockOverviewTooltipComponent,
    TransactionsListComponent,
    AddressComponent,
    AddressPreviewComponent,
    SearchFormComponent,
    TimeSpanComponent,
    AddressLabelsComponent,
    FooterComponent,
    AssetComponent,
    AssetsComponent,
    StatusViewComponent,
    FeesBoxComponent,
    DifficultyComponent,
    TermsOfServiceComponent,
    PrivacyPolicyComponent,
    TrademarkPolicyComponent,
    SponsorComponent,
    PushTransactionComponent,
    AssetsNavComponent,
    AssetsFeaturedComponent,
    AssetGroupComponent,
    AssetCirculationComponent,
    AmountShortenerPipe,
    DifficultyAdjustmentsTable,
    BlocksList,
    DataCyDirective,
    RewardStatsComponent,
    LoadingIndicatorComponent,
    IndexingProgressComponent,
    SvgImagesComponent,
    ChangeComponent,
    SatsComponent,
    SearchResultsComponent,
    TimestampComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    NgbNavModule,
    NgbTooltipModule,
    NgbButtonsModule,
    NgbPaginationModule,
    NgbTypeaheadModule,
    NgbDropdownModule,
    NgbCollapseModule,
    InfiniteScrollModule,
    FontAwesomeModule,
  ],
  providers: [
    VbytesPipe,
    RelativeUrlPipe,
    NoSanitizePipe,
    ShortenStringPipe,
    CapAddressPipe,
    AmountShortenerPipe,
  ],
  exports: [
    RouterModule,
    ReactiveFormsModule,
    NgbNavModule,
    NgbTooltipModule,
    NgbButtonsModule,
    NgbPaginationModule,
    NgbTypeaheadModule,
    NgbDropdownModule,
    NgbCollapseModule,
    InfiniteScrollModule,
    FontAwesomeModule,
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
    StartComponent,
    TransactionComponent,
    BlockComponent,
    BlockPreviewComponent,
    BlockAuditComponent,
    BlockOverviewGraphComponent,
    BlockOverviewTooltipComponent,
    TransactionsListComponent,
    AddressComponent,
    AddressPreviewComponent,
    SearchFormComponent,
    TimeSpanComponent,
    AddressLabelsComponent,
    FooterComponent,
    AssetComponent,
    AssetsComponent,
    StatusViewComponent,
    FeesBoxComponent,
    DifficultyComponent,
    TermsOfServiceComponent,
    PrivacyPolicyComponent,
    TrademarkPolicyComponent,
    SponsorComponent,
    PushTransactionComponent,
    AssetsNavComponent,
    AssetsFeaturedComponent,
    AssetGroupComponent,
    AssetCirculationComponent,
    AmountShortenerPipe,
    DifficultyAdjustmentsTable,
    BlocksList,
    DataCyDirective,
    RewardStatsComponent,
    LoadingIndicatorComponent,
    IndexingProgressComponent,
    SvgImagesComponent,
    ChangeComponent,
    SatsComponent,
    SearchResultsComponent,
    TimestampComponent,
  ]
})
export class SharedModule {
  constructor(library: FaIconLibrary) {
    library.addIcons(faInfoCircle);
    library.addIcons(faChartArea);
    library.addIcons(faTv);
    library.addIcons(faTachometerAlt);
    library.addIcons(faCubes);
    library.addIcons(faHammer);
    library.addIcons(faCogs);
    library.addIcons(faThList);
    library.addIcons(faList);
    library.addIcons(faTachometerAlt);
    library.addIcons(faDatabase);
    library.addIcons(faSearch);
    library.addIcons(faLink);
    library.addIcons(faBolt);
    library.addIcons(faTint);
    library.addIcons(faFilter);
    library.addIcons(faAngleDown);
    library.addIcons(faAngleUp);
    library.addIcons(faExchangeAlt);
    library.addIcons(faAngleDoubleUp);
    library.addIcons(faAngleDoubleDown);
    library.addIcons(faChevronDown);
    library.addIcons(faFileAlt);
    library.addIcons(faRedoAlt);
    library.addIcons(faArrowAltCircleRight);
    library.addIcons(faExternalLinkAlt);
    library.addIcons(faSortUp);
    library.addIcons(faCaretUp);
    library.addIcons(faCaretDown);
    library.addIcons(faAngleRight);
    library.addIcons(faAngleLeft);
    library.addIcons(faBook);
    library.addIcons(faListUl);
    library.addIcons(faDownload);
    library.addIcons(faQrcode);
  }
}
