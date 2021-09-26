import { Component, Input, OnInit } from '@angular/core';
import { Env, StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-code-template',
  templateUrl: './code-template.component.html',
  styleUrls: ['./code-template.component.scss']
})
export class CodeTemplateComponent implements OnInit {
  @Input() network: string;
  @Input() code: any;
  @Input() hostname: string;
  @Input() method: 'get' | 'post' | 'websocket' = 'get';
  env: Env;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.env = this.stateService.env;
  }

  npmGithubLink(){
    let npmLink = `https://github.com/mempool/mempool.js`;
    if (this.network === 'bisq') {
      npmLink = `https://github.com/mempool/mempool.js/tree/main/npm-bisq-js`;
    }
    if (this.network === 'liquid') {
      npmLink = `https://github.com/mempool/mempool.js/tree/main/npm-liquid-js`;
    }
    return npmLink;
  }

  npmModuleLink() {
    let npmLink = `https://www.npmjs.org/package/@mempool/mempool.js`;
    if (this.network === 'bisq') {
      npmLink = `https://www.npmjs.org/package/@mempool/bisq.js`;
    }
    if (this.network === 'liquid') {
      npmLink = `https://www.npmjs.org/package/@mempool/liquid.js`;
    }
    return npmLink;
  }

  normalizeHostsESModule(codeText: string) {
    if (this.env.BASE_MODULE === 'mempool') {
      if (['liquid', 'bisq'].includes(this.network)) {
        codeText = codeText.replace('%{0}', this.network);
      } else {
        codeText = codeText.replace('%{0}', 'bitcoin');
      }
      if(['', 'main', 'liquid', 'bisq'].includes(this.network)) {
        codeText = codeText.replace('mempoolJS();', `mempoolJS({
    hostname: '${document.location.hostname}'
  });`);
      } else {
        codeText = codeText.replace('mempoolJS();', `mempoolJS({
    hostname: '${document.location.hostname}',
    network: '${this.network}'
  });`);
      }
    }

    if (this.env.BASE_MODULE === 'bisq') {
      codeText = codeText.replace('} = mempoolJS();', ` = bisqJS();`);
      codeText = codeText.replace('{ %{0}: ', '');
    }

    if (this.env.BASE_MODULE === 'liquid') {
      codeText = codeText.replace('} = mempoolJS();', ` = liquidJS();`);
      codeText = codeText.replace('{ %{0}: ', '');
    }
    return codeText;
  }

  normalizeHostsCommonJS(codeText: string) {
    if (this.env.BASE_MODULE === 'mempool') {
      if (['liquid', 'bisq'].includes(this.network)) {
        codeText = codeText.replace('%{0}', this.network);
      } else {
        codeText = codeText.replace('%{0}', 'bitcoin');
      }
      if(['', 'main', 'liquid', 'bisq'].includes(this.network)) {
        codeText = codeText.replace('mempoolJS();', `mempoolJS({
          hostname: '${document.location.hostname}'
        });`);
      } else {
        codeText = codeText.replace('mempoolJS();', `mempoolJS({
          hostname: '${document.location.hostname}',
          network: '${this.network}'
        });`);
      }
    }

    if (this.env.BASE_MODULE === 'bisq') {
      codeText = codeText.replace('} = mempoolJS();', ` = bisqJS();`);
      codeText = codeText.replace('{ %{0}: ', '');
    }

    if (this.env.BASE_MODULE === 'liquid') {
      codeText = codeText.replace('} = mempoolJS();', ` = liquidJS();`);
      codeText = codeText.replace('{ %{0}: ', '');
    }
    return codeText;
  }

  wrapEsModule(code: any) {
    let codeText: string;
    if (code.codeTemplate) {
      codeText = this.normalizeHostsESModule(code.codeTemplate.esModule);

      if(this.network === '' || this.network === 'main') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleMainnet.esModule);
      }
      if (this.network === 'testnet') {
      codeText = this.replaceJSPlaceholder(codeText, code.codeSampleTestnet.esModule);
      }
      if (this.network === 'signet') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleSignet.esModule);
      }
      if (this.network === 'liquid') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleLiquid.esModule);
      }
      if (this.network === 'bisq') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleBisq.esModule);
      }

      let importText = `import mempoolJS from "@mempool/mempool.js";`;
      if (this.env.BASE_MODULE === 'bisq') {
        importText = `import bisqJS from "@mempool/bisq.js";`;
      }
      if (this.env.BASE_MODULE === 'liquid') {
        importText = `import liquidJS from "@mempool/liquid.js";`;
      }

      return `${importText}

const init = async () => {
  ${codeText}
};
init();`;
    }
  }

  wrapCommonJS(code: any) {
    let codeText: string;
    if (code.codeTemplate) {
      codeText = this.normalizeHostsCommonJS(code.codeTemplate.commonJS);

      if(this.network === '' || this.network === 'main') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleMainnet.esModule);
      }
      if (this.network === 'testnet') {
      codeText = this.replaceJSPlaceholder(codeText, code.codeSampleTestnet.esModule);
      }
      if (this.network === 'signet') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleSignet.esModule);
      }
      if (this.network === 'liquid') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleLiquid.esModule);
      }
      if (this.network === 'bisq') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleBisq.esModule);
      }

      let importText = `<script src="https://mempool.space/mempool.js"></script>`;
      if (this.env.BASE_MODULE === 'bisq') {
        importText = `<script src="https://bisq.markets/bisq.js"></script>`;
      }
      if (this.env.BASE_MODULE === 'liquid') {
        importText = `<script src="https://liquid.network/liquid.js"></script>`;
      }

      let resultHtml = '<pre id="result"></pre>';
      if (this.method === 'websocket') {
        resultHtml = `<pre id="result-blocks"></pre>
    <pre id="result-mempool-info"></pre>
    <pre id="result-transactions"></pre>
    <pre id="result-mempool-blocks"></pre>`;
      }

      return `<!DOCTYPE html>
<html>
  <head>
    ${importText}
    <script>
      const init = async () => {
        ${codeText}
      };
      init();
    </script>
  </head>
  <body>
    ${resultHtml}
  </body>
</html>`;
    }
  }

  wrapImportTemplate() {

    let importTemplate = `# npm
npm install @mempool/mempool.js --save

# yarn
yarn add @mempool/mempool.js`;

    if (this.env.BASE_MODULE === 'bisq') {
      importTemplate = `# npm
npm install @mempool/bisq.js --save

# yarn
yarn add @mempool/bisq.js`;
    }

    if (this.env.BASE_MODULE === 'liquid') {
      importTemplate = `# npm
npm install @mempool/liquid.js --save

# yarn
yarn add @mempool/liquid.js`;
    }

    return importTemplate;
  }

  wrapCurlTemplate(code: any) {
    if (code.codeTemplate) {
      if (this.network === 'testnet') {
        return this.replaceCurlPlaceholder(code.codeTemplate.curl, code.codeSampleTestnet);
      }
      if (this.network === 'signet') {
        return this.replaceCurlPlaceholder(code.codeTemplate.curl, code.codeSampleSignet);
      }
      if (this.network === 'liquid') {
        return this.replaceCurlPlaceholder(code.codeTemplate.curl, code.codeSampleLiquid);
      }
      if (this.network === 'bisq') {
        return this.replaceCurlPlaceholder(code.codeTemplate.curl, code.codeSampleBisq);
      }
      if (this.network === '' || this.network === 'main') {
        return this.replaceCurlPlaceholder(code.codeTemplate.curl, code.codeSampleMainnet);
      }
    }
  }

  wrapResponse(code: any) {
    if (this.method === 'websocket') {
      return '';
    }
    if (this.network === 'testnet') {
      return code.codeSampleTestnet.response;
    }
    if (this.network === 'signet') {
      return code.codeSampleSignet.response;
    }
    if (this.network === 'liquid') {
      return code.codeSampleLiquid.response;
    }
    if (this.network === 'bisq') {
      return code.codeSampleBisq.response;
    }
    return code.codeSampleMainnet.response;
  }

  replaceJSPlaceholder(text: string, code: any) {
    for (let index = 0; index < code.length; index++) {
      const textReplace = code[index];
      const indexNumber = index + 1;
      text = text.replace('%{' + indexNumber + '}', textReplace);
    }
    return text;
  }

  replaceCurlPlaceholder(curlText: any, code: any) {
    let text = curlText;
    for (let index = 0; index < code.curl.length; index++) {
      const textReplace = code.curl[index];
      const indexNumber = index + 1;
      text = text.replace('%{' + indexNumber + '}', textReplace);
    }

    if (this.env.BASE_MODULE === 'mempool') {
      if (this.network === 'main' || this.network === '') {
        if (this.method === 'post') {
          return `curl -X POST -sSLd "${text}"`;
        }
        return `curl -sSL "${this.hostname}${text}"`;
      }
      if (this.method === 'post') {
        text = text.replace('/api', `/${this.network}/api`);
        return `curl -X POST -sSLd "${text}"`;
      }
      return `curl -sSL "${this.hostname}/${this.network}${text}"`;
    }
    if (this.env.BASE_MODULE !== 'mempool') {
      return `curl -sSL "${this.hostname}${text}"`;
    }
  }

}
