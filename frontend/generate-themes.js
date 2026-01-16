const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const THEMES = ['contrast', 'softsimon', 'bukele'];
const STAGING_DIR = path.join(__dirname, '.theme-build');
const DIST_DIR = path.join(__dirname, 'dist/mempool/browser');
const MANIFEST_FILE = path.join(__dirname, 'theme-manifest.json');

const command = process.argv[2];

if (command === 'copy') {
  const themeFiles = fs.readdirSync(STAGING_DIR).filter(f => f.endsWith('.css'));
  for (const dir of fs.readdirSync(DIST_DIR, { withFileTypes: true })) {
    if (dir.isDirectory()) {
      for (const file of themeFiles) {
        fs.copyFileSync(path.join(STAGING_DIR, file), path.join(DIST_DIR, dir.name, file));
      }
    }
  }
  console.log(`Copied ${themeFiles.length} theme files to all locale directories`);
} else {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  fs.mkdirSync(STAGING_DIR, { recursive: true });

  const manifest = {};

  for (const theme of THEMES) {
    const inputFile = path.join(__dirname, `src/theme-${theme}.scss`);
    const tempOutput = path.join(STAGING_DIR, `${theme}.tmp.css`);

    try {
      execSync(`npx sass --style=compressed --no-source-map "${inputFile}" "${tempOutput}"`, {
        stdio: 'pipe'
      });
    } catch (e) {
      console.error(`Failed to compile theme-${theme}.scss:`, e.message);
      process.exit(1);
    }

    const css = fs.readFileSync(tempOutput);
    const hash = crypto.createHash('md5').update(css).digest('hex').slice(0, 16);

    const nonHashedFilename = `${theme}.css`;
    fs.copyFileSync(tempOutput, path.join(STAGING_DIR, nonHashedFilename));

    const hashedFilename = `${theme}.${hash}.css`;
    fs.renameSync(tempOutput, path.join(STAGING_DIR, hashedFilename));

    manifest[theme] = hashedFilename;
    console.log(`Built ${nonHashedFilename} and ${hashedFilename}`);
  }

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  console.log('Theme manifest written to theme-manifest.json');
}
