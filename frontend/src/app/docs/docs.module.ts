import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '@app/shared/shared.module';
import { ApiDocsComponent } from '@app/docs/api-docs/api-docs.component';
import { DocsComponent } from '@app/docs/docs/docs.component';
import { ApiDocsNavComponent } from '@app/docs/api-docs/api-docs-nav.component';
import { CodeTemplateComponent } from '@app/docs/code-template/code-template.component';
import { DocsRoutingModule } from '@app/docs/docs.routing.module';
import { FaqTemplateDirective } from '@app/docs/faq-template/faq-template.component';
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
    DocsRoutingModule,
  ]
})
export class DocsModule { }
