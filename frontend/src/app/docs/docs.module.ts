import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { ApiDocsComponent } from './/api-docs/api-docs.component';
import { DocsComponent } from './docs/docs.component';
import { ApiDocsNavComponent } from './api-docs/api-docs-nav.component';
import { CodeTemplateComponent } from './code-template/code-template.component';
import { DocsRoutingModule } from './docs.routing.module';
import { FaqTemplateDirective } from './faq-template/faq-template.component';
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
