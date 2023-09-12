#/bin/sh
set -e

# Remove previous dist folder
rm -rf dist
# Build new dist folder
npm run build
# Remove previous package folder
rm -rf package
# Move JS and deps
mv dist package
cp -R node_modules package
# Remove symlink for rust-gbt and insert real folder
rm package/node_modules/rust-gbt
cp -R rust-gbt package/node_modules
# Clean up deps
npm run package-rm-build-deps
