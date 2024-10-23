import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DocsComponent } from '@app/docs/docs/docs.component';

const browserWindow = window || {};
// @ts-ignore
const browserWindowEnv = browserWindow.__env || {};

let routes: Routes = [];

if (browserWindowEnv.BASE_MODULE && browserWindowEnv.BASE_MODULE === 'liquid') {
  routes = [
    {
      path: '',
      redirectTo: 'api/rest',
      pathMatch: 'full'
    },
    {
      path: 'api/:type',
      component: DocsComponent
    },
    {
      path: 'api',
      redirectTo: 'api/rest',
      pathMatch: 'full'
    },
    {
      path: '**',
      redirectTo: 'api/rest',
      pathMatch: 'full'
    }
  ];
} else {
  routes = [
    {
      path: '',
      pathMatch: 'full',
      redirectTo: 'faq'
    },
    {
      path: 'api/:type',
      component: DocsComponent
    },
    {
      path: 'faq',
      data: { networks: ['bitcoin'] },
      component: DocsComponent
    },
    {
      path: 'api',
      redirectTo: 'api/rest'
    },
    {
      path: '**',
      redirectTo: 'api/faq'
    }
  ];
}

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class DocsRoutingModule { }
