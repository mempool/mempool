import { Component, Input, OnInit } from '@angular/core';
import { Env, StateService } from '@app/services/state.service';

@Component({
  selector: 'app-code-template',
  templateUrl: './code-template.component.html',
  styleUrls: ['./code-template.component.scss']
})
export class CodeTemplateComponent implements OnInit {
  @Input() network: string;
  @Input() code: any;
  @Input() hostname: string;
  @Input() baseNetworkUrl: string;
  @Input() method: 'GET' | 'POST' | 'websocket' = 'GET';
  @Input() showCodeExample: any;
  env: Env;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.env = this.stateService.env;
  }

  adjustContainerHeight( event ) {
    if( ( window.innerWidth <= 992 ) && ( this.method !== "websocket" ) ) {
      const urlObj = new URL( window.location + "" );
      const endpointContainerEl = document.querySelector<HTMLElement>( urlObj.hash );
      const endpointContentEl = document.querySelector<HTMLElement>( urlObj.hash + " .endpoint-content" );
      window.setTimeout( function() {
        endpointContainerEl.style.height = endpointContentEl.clientHeight + 90 + "px";
      }, 550);
    }
  }

  npmGithubLink(){
    let npmLink = `https://github.com/mempool/mempool.js`;
    if (this.network === 'liquid' || this.network === 'liquidtestnet') {
      npmLink = `https://github.com/mempool/mempool.js/tree/main/npm-liquid-js`;
    }
    return npmLink;
  }

  npmModuleLink() {
    let npmLink = `https://www.npmjs.org/package/@mempool/mempool.js`;
    if (this.network === 'liquid' || this.network === 'liquidtestnet') {
      npmLink = `https://www.npmjs.org/package/@mempool/liquid.js`;
    }
    return npmLink;
  }

  normalizeHostsESModule(codeText: string) {
    if (this.env.BASE_MODULE === 'mempool') {
      if (['liquid'].includes(this.network)) {
        codeText = codeText.replace('%{0}', this.network);
      } else {
        codeText = codeText.replace('%{0}', 'bitcoin');
      }
      if(['', 'main', 'liquid', 'liquidtestnet'].includes(this.network)) {
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

    if (this.env.BASE_MODULE === 'liquid') {
      codeText = codeText.replace('} = mempoolJS();', ` = liquidJS();`);
      codeText = codeText.replace('{ %{0}: ', '');
    }
    return codeText;
  }

  normalizeHostsCommonJS(codeText: string) {
    if (this.env.BASE_MODULE === 'mempool') {
      if (['liquid'].includes(this.network)) {
        codeText = codeText.replace('%{0}', this.network);
      } else {
        codeText = codeText.replace('%{0}', 'bitcoin');
      }
      if(['', 'main', 'liquid'].includes(this.network)) {
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
      if (this.network === 'testnet4') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleTestnet.esModule);
      }
      if (this.network === 'signet') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleSignet.esModule);
      }
      if (this.network === 'liquid' || this.network === 'liquidtestnet') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleLiquid.esModule);
      }

      let importText = `import mempoolJS from "@mempool/mempool.js";`;
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
      if (this.network === 'testnet4') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleTestnet.esModule);
      }
      if (this.network === 'signet') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleSignet.esModule);
      }
      if (this.network === 'liquid' || this.network === 'liquidtestnet') {
        codeText = this.replaceJSPlaceholder(codeText, code.codeSampleLiquid.esModule);
      }

      if (code.noWrap) {
        return codeText;
      }

      let importText = `<script src="https://mempool.space/mempool.js"></script>`;
      if (this.env.BASE_MODULE === 'liquid') {
        importText = `<script src="https://liquid.network/liquid.js"></script>`;
      }

      let resultHtml = '<pre id="result"></pre>';
      if (this.method === 'websocket') {
        resultHtml = `<h2>Blocks</h2><pre id="result-blocks">Waiting for data</pre><br>
    <h2>Mempool Info</h2><pre id="result-mempool-info">Waiting for data</pre><br>
    <h2>Transactions</h2><pre id="result-transactions">Waiting for data</pre><br>
    <h2>Mempool Blocks</h2><pre id="result-mempool-blocks">Waiting for data</pre><br>`;
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
      if (this.network === 'testnet4') {
        return this.replaceCurlPlaceholder(code.codeTemplate.curl, code.codeSampleTestnet);
      }
      if (this.network === 'signet') {
        return this.replaceCurlPlaceholder(code.codeTemplate.curl, code.codeSampleSignet);
      }
      if (this.network === 'liquid') {
        return this.replaceCurlPlaceholder(code.codeTemplate.curl, code.codeSampleLiquid);
      }
      if (this.network === 'liquidtestnet') {
        return this.replaceCurlPlaceholder(code.codeTemplate.curl, code.codeSampleLiquidTestnet);
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
    if (this.network === 'testnet4') {
      return code.codeSampleTestnet.response;
    }
    if (this.network === 'signet') {
      return code.codeSampleSignet.response;
    }
    if (this.network === 'liquid') {
      return code.codeSampleLiquid.response;
    }
    if (this.network === 'liquidtestnet') {
      return code.codeSampleLiquidTestnet.response;
    }
    return code.codeSampleMainnet.response;
  }

  wrapPythonTemplate(code: any) {
    return ( ( this.network === 'testnet' || this.network === 'testnet4' || this.network === 'signet' ) ? ( code.codeTemplate.python.replace( "wss://mempool.space/api/v1/ws", "wss://mempool.space/" + this.network + "/api/v1/ws" ) ) : code.codeTemplate.python );
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
    text = text.replace( "[[hostname]]", this.hostname );
    text = text.replace( "[[baseNetworkUrl]]", this.baseNetworkUrl );
    for (let index = 0; index < code.curl.length; index++) {
      const textReplace = code.curl[index];
      const indexNumber = index + 1;
      text = text.replace('%{' + indexNumber + '}', textReplace);
    }

    const headersString = code.headers ? ` -H "${code.headers}"` : ``;
    
    if (this.env.BASE_MODULE === 'mempool') {
      if (this.network === 'main' || this.network === '' || this.network === this.env.ROOT_NETWORK) {
        if (this.method === 'POST') {
          return `curl${headersString} -X POST -sSLd "${text}"`;
        }
        return `curl${headersString} -sSL "${this.hostname}${text}"`;
      }
      if (this.method === 'POST') {
        return `curl${headersString} -X POST -sSLd "${text}"`;
      }
      return `curl${headersString} -sSL "${this.hostname}/${this.network}${text}"`;
    } else if (this.env.BASE_MODULE === 'liquid') {
      if (this.method === 'POST') {
        if (this.network !== 'liquid' || this.network === this.env.ROOT_NETWORK) {
          text = text.replace('/api', `/${this.network}/api`);
        }
        return `curl${headersString} -X POST -sSLd "${text}"`;
      }
      return ( this.network === 'liquid' ? `curl${headersString} -sSL "${this.hostname}${text}"` : `curl${headersString} -sSL "${this.hostname}/${this.network}${text}"` );
    } else {
        return `curl${headersString} -sSL "${this.hostname}${text}"`;
    }

  }

}
