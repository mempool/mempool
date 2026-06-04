import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsModule } from 'ngx-echarts';
import { SharedModule } from '@app/shared/shared.module';
import { ApiDocsComponent } from '@app/docs/api-docs/api-docs.component';
import { DocsComponent } from '@app/docs/docs/docs.component';
import { ApiDocsNavComponent } from '@app/docs/api-docs/api-docs-nav.component';
import { CodeTemplateComponent } from '@app/docs/code-template/code-template.component';
import { DocsRoutingModule } from '@app/docs/docs.routing.module';
import { FaqTemplateDirective } from '@app/docs/faq-template/faq-template.component';
import { TaprootAddressScriptsModule } from '@components/taproot-address-scripts/taproot-address-scripts.module';
@NgModule({
  declarations: [
    ApiDocsComponent,
    CodeTemplateComponent,
    ApiDocsNavComponent,
    DocsComponent,
    FaqTemplateDirective,
  ],
  imports: [
    CommonModule,
    SharedModule,
    TaprootAddressScriptsModule,
    DocsRoutingModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('@app/graphs/echarts').then(m => m.echarts),
    }),
  ]
})
export class DocsModule { }
