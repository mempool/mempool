import fs from 'fs';

const defaultConfig = {
  "domains": ["mempool.space"],
  "theme": "default",
  "enterprise": "mempool",
  "branding": {
    "name": "mempool",
    "title": "mempool",
    "site_id": 5,
  },
  "meta": {
    "title": "mempool - Bitcoin Explorer",
    "description": "Explore the full Bitcoin ecosystem with The Mempool Open Source Project®. See the real-time status of your transactions, get network info, and more.",
  },
  "unfurls": {
    "preview": {
      "src": "https://mempool.space/resources/previews/mempool-space-preview.jpg",
      "type": "image/jpeg",
      "width": "2000",
      "height": "1000"
    }
  }
}

function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      target[key] = target[key] || {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function addDefaultsToConfig(config) {
  return deepMerge(structuredClone(defaultConfig), config);
}

function substitute(indexhtml, config) {
  let newhtml = indexhtml;
  // substitute title
  newhtml = newhtml.replace(/\<\!\-\- TITLE \-\-\>.*\<\!\-\- END TITLE \-\-\>/gis, `<title>${config.meta.title}</title>`);

  // substitute customization script
  newhtml = newhtml.replace(/\<\!\-\- CUSTOMIZATION \-\-\>.*\<\!\-\- END CUSTOMIZATION \-\-\>/gis, `<script>
    window.__env = window.__env || {};
    window.__env.CUSTOMIZATION = 'auto';
    window.__env.customize = ${JSON.stringify(config)};
  </script>`);

  // substitute meta tags
  newhtml = newhtml.replace(/\<\!\-\- META \-\-\>.*\<\!\-\- END META \-\-\>/gis, `<meta name="description" content="${config.meta.description}" />
  <meta property="og:image" content="${config.unfurls.preview.src}" />
  <meta property="og:image:type" content="${config.unfurls.preview.type}" />
  <meta property="og:image:width" content="${config.unfurls.preview.width}" />
  <meta property="og:image:height" content="${config.unfurls.preview.height}" />
  <meta property="og:description" content="${config.meta.description}" />
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@mempool">
  <meta name="twitter:creator" content="@mempool">
  <meta name="twitter:title" content="${config.meta.title}">
  <meta name="twitter:description" content="${config.meta.description}" />
  <meta name="twitter:image" content="${config.unfurls.preview.src}" />
  <meta name="twitter:domain" content="${config.domains[0]}">`);


  // substitute favicons
  newhtml = newhtml.replace(/\<\!\-\- FAVICONS -->.*\<\!\-\- END FAVICONS \-\-\>/gis, `<link rel="apple-touch-icon" sizes="180x180" href="/resources/${config.enterprise}/favicons/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/resources/${config.enterprise}/favicons/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/resources/${config.enterprise}/favicons/favicon-16x16.png">
  <link rel="manifest" href="/resources/${config.enterprise}/favicons/site.webmanifest">
  <link rel="shortcut icon" href="/resources/${config.enterprise}/favicons/favicon.ico">
  <link id="canonical" rel="canonical" href="${config.domains[0]}">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black">
  <meta name="msapplication-TileColor" content="#000000">
  <meta name="msapplication-config" content="/resources/${config.enterprise}/favicons/browserconfig.xml">
  <meta name="theme-color" content="#1d1f31">`);

  return newhtml;
}

async function run() {
  const servicesHost = process.argv[2] || 'http://localhost:9000';
  const mempoolDir = process.argv[3] || '../frontend/dist/mempool/browser';

  console.log('fetching list of custom builds');
  const customBuilds = await (await fetch(`${servicesHost}/api/v1/internal/enterprise/dashboard/list`)).json();

  // fetch config for each custom build from `$SERVICES/api/v1/internal/enterprise/dashboard/config/<custom_build_id>`
  const customConfigs = await Promise.all(customBuilds.map(async (build) => {
    console.log(`fetching config for ${build} `);
    return addDefaultsToConfig(await (await fetch(`${servicesHost}/api/v1/internal/enterprise/dashboard/${build}`)).json());
  }));

  
  // for each custom build config:
  let i = 0;
  for (const config of customConfigs) {
    console.log(`generating ${config.enterprise} build (${i + 1}/${customConfigs.length})`);
    const browserDir = mempoolDir;
    const locales = fs.readdirSync(browserDir)
      .filter(file => fs.statSync(`${browserDir}/${file}`).isDirectory())
      .filter(file => fs.existsSync(`${browserDir}/${file}/index.html`));

    // Process each locale's index.html
    for (const locale of locales) {
      const indexPath = `${browserDir}/${locale}/index.html`;
      const indexContent = fs.readFileSync(indexPath, 'utf-8').toString();
      const processedHtml = substitute(indexContent, config);

      // Save processed HTML
      for (const subdomain of config.domains.map(domain => domain.split('.')[0])) {
        const outputPath = `${browserDir}/${locale}/index.${subdomain}.html`;
        fs.writeFileSync(outputPath, processedHtml);
        console.log(`updated index.${subdomain}.html for locale ${locale}`);
      }
    }

    console.log(`finished generating ${config.enterprise} build`);
    i++;
  }

  console.log('finished updating custom builds');
}

run();
