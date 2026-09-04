import path from 'path';

// Required from the rust/gbt source tree rather than through the `rust-gbt`
// package so this test needs no built native binding. `to-backend` copies the
// same file into backend/rust-gbt/ alongside the wrapper that consumes it.
const { NAPI_LOADER, localBindingName, resolveBinding } = require('../../../../rust/gbt/binding-name.js');

const BINDING_DIR = path.join('/opt', 'mempool', 'backend', 'rust-gbt');

describe('Rust GBT binding resolution', () => {
  describe('localBindingName', () => {
    it('should name the FreeBSD arm64 binding that napi-rs cannot load itself', () => {
      expect(localBindingName('freebsd', 'arm64')).toBe('gbt.freebsd-arm64.node');
    });

    it('should name the FreeBSD x64 binding', () => {
      expect(localBindingName('freebsd', 'x64')).toBe('gbt.freebsd-x64.node');
    });

    it('should name the macOS arm64 binding', () => {
      expect(localBindingName('darwin', 'arm64')).toBe('gbt.darwin-arm64.node');
    });

    it('should default to the host platform and arch', () => {
      expect(localBindingName()).toBe(`gbt.${process.platform}-${process.arch}.node`);
    });
  });

  describe('resolveBinding', () => {
    it('should resolve the co-located binding when it exists', () => {
      const expected = path.join(BINDING_DIR, 'gbt.freebsd-arm64.node');
      const exists = jest.fn().mockReturnValue(true);
      expect(resolveBinding(BINDING_DIR, exists, 'freebsd', 'arm64')).toBe(expected);
      expect(exists).toHaveBeenCalledWith(expected);
    });

    it('should fall back to the napi-rs loader when no local binding exists', () => {
      expect(NAPI_LOADER).toBe('./index.napi.js');
      expect(resolveBinding(BINDING_DIR, () => false, 'freebsd', 'arm64')).toBe(NAPI_LOADER);
    });

    it('should fall back on Linux, where napi-rs appends an ABI suffix', () => {
      // napi-rs builds gbt.linux-x64-gnu.node for x86_64-unknown-linux-gnu, so
      // the ABI-less name never matches and napi-rs's own loader takes over.
      const exists = (p: string): boolean => p.endsWith('gbt.linux-x64-gnu.node');
      expect(resolveBinding(BINDING_DIR, exists, 'linux', 'x64')).toBe(NAPI_LOADER);
    });
  });
});
