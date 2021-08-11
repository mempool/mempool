import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-code-template',
  templateUrl: './code-template.component.html',
  styleUrls: ['./code-template.component.scss']
})
export class CodeTemplateComponent {
  @Input() network: string;
  @Input() layer: string;
  @Input() code: {
    codeSample: {
      esModule: string;
      commonJS: string;
      curl: string;
    },
    responseSample: string;
  };
  hostname = document.location.hostname;

  constructor(
  ) { }

  npmGithubLink(){
    let npmLink = `https://github.com/mempool/mempool.js`;
    if (this.layer === 'bisq') {
      npmLink = `https://github.com/mempool/mempool.js/tree/main/npm-bisq-js`;
    }
    if (this.layer === 'liquid') {
      npmLink = `https://github.com/mempool/mempool.js/tree/main/npm-liquid-js`;
    }
    return npmLink;
  }

  npmModuleLink() {
    let npmLink = `https://www.npmjs.org/package/@mempool/mempool.js`;
    if (this.layer === 'bisq') {
      npmLink = `https://www.npmjs.org/package/@mempool/bisq.js`;
    }
    if (this.layer === 'liquid') {
      npmLink = `https://www.npmjs.org/package/@mempool/liquid.js`;
    }
    return npmLink;
  }

  normalizeCodeHostname(code: string) {
    let codeText: string;
    if (this.network === 'bisq' || this.network === 'liquid'){
      codeText = code.replace('%{1}', this.network);
    }else{
      codeText = code.replace('%{1}', 'bitcoin');
    }
    return codeText;
  }

  wrapESmodule(code: string) {
    let codeText = this.normalizeCodeHostname(code);

    if (this.network && this.network !== 'mainnet') {
      codeText = codeText.replace('mempoolJS();', `mempoolJS({
    hostname: '${this.hostname}/${this.network}'
  });` );
    }

    let importText = `import mempoolJS from "@mempool/mempool.js";`;
    if (this.layer === 'bisq') {
      importText = `import bisqJS from "@mempool/bisq.js";`;
    }
    if (this.layer === 'liquid') {
      importText = `import liquidJS from "@mempool/liquid.js";`;
    }

    return `${importText}

const init = async () => {
  ${codeText}
};
init();`;
  }

  wrapCommonJS(code: string) {
    let codeText = this.normalizeCodeHostname(code);

    if (this.network && this.network !== 'mainnet') {
      codeText = codeText.replace('mempoolJS();', `mempoolJS({
          hostname: '${this.hostname}/${this.network}'
        });` );
    }

    let importText = `<script src="https://mempool.space/mempool.js"></script>`;
    if (this.layer === 'bisq') {
      importText = `<script src="https://bisq.markets/bisq.js"></script>`;
    }
    if (this.layer === 'liquid') {
      importText = `<script src="https://liquid.network/liquid.js"></script>`;
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
  <body></body>
</html>`;
  }
  wrapCurl(code: string) {
    if (this.network && this.network !== 'mainnet') {
      return code.replace('mempool.space/', `mempool.space/${this.network}/`);
    }
    return code;
  }

  wrapImportTemplate() {

    let importTemplate = `# npm
npm install @mempool/mempool.js --save

# yarn
yarn add @mempool/mempool.js`;

    if (this.layer === 'bisq') {
      importTemplate = `# npm
npm install @mempool/bisq.js --save

# yarn
yarn add @mempool/bisq.js`;
    }

    if (this.layer === 'liquid') {
      importTemplate = `# npm
npm install @mempool/liquid.js --save

# yarn
yarn add @mempool/liquid.js`;
    }

    return importTemplate;
  }

}
