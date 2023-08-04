#/bin/sh
set -e

npm run build
# Remove previous package folder
rm -rf package
# Move JS and deps
mv dist package
mv node_modules package
# Remove symlink for rust-gbt and insert real folder
rm package/node_modules/rust-gbt
mv rust-gbt package/node_modules
# Clean up deps
npm run package-rm-build-deps
