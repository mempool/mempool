'use strict';

module.exports = {
  'no-unhandled-await': {
    meta: {
      type: 'problem',
      docs: {
        description: 'forbid unhandled await unless callee is @asyncSafe, context is @asyncUnsafe, or rejection is explicitly handled',
      },
      schema: [{
        type: 'object',
        properties: {
          safeTag:   { type: 'string' }, // jsdoc tag that marks a callee safe (default '@asyncSafe')
          unsafeTag: { type: 'string' }, // comment/jsdoc that marks a context unsafe (default '@asyncUnsafe')
          allowAllSettled:     { type: 'boolean' },
          allowCatchMethod:    { type: 'boolean' },
          allowThenWithTwoArgs:{ type: 'boolean' },
        },
        additionalProperties: false,
      }],
      messages: {
        unhandled:
          'await of non-@asyncSafe callee in @asyncSafe context; use try/catch or annotate callee (@asyncSafe) or context (@asyncUnsafe)',
        unhandledVoid:
          'void of non-@asyncSafe callee; annotate callee with @asyncSafe or handle the promise properly',
      },
    },

    create(context) {
      const src = context.getSourceCode();
      const opt = Object.assign(
        {
          safeTag: '@asyncSafe',
          unsafeTag: '@asyncUnsafe',
          allowAllSettled: true,
          allowCatchMethod: true,
          allowThenWithTwoArgs: true,
        },
        (context.options && context.options[0]) || {}
      );

      // optional typescript API (for cross-file/class resolution)
      let ts = null, services = null, checker = null, es2ts = null;
      try {
        // eslint will only populate parserServices if @typescript-eslint/parser + parserOptions.project are set
        services = context.parserServices || null;
        // @ts-ignore
        if (services && (services.program || services.esTreeNodeToTSNodeMap)) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          ts = require('typescript');
          // @ts-ignore
          const program = services.program;
          // @ts-ignore
          es2ts = services.esTreeNodeToTSNodeMap;
          checker = program?.getTypeChecker?.();
        }
      } catch { /* noop */ }

      const hasRange = (n) => n && Array.isArray(n.range);
      const inside = (n, o) => hasRange(n) && hasRange(o) && n.range[0] >= o.range[0] && n.range[1] <= o.range[1];
      const before = (a, b) => hasRange(a) && hasRange(b) && a.range[0] < b.range[0];

      const isFnNode = (n) =>
        n &&
        (n.type === 'FunctionDeclaration' ||
         n.type === 'FunctionExpression' ||
         n.type === 'ArrowFunctionExpression' ||
         n.type === 'MethodDefinition');

      const isCommentWith = (c, tag) => typeof c?.value === 'string' && c.value.includes(tag);

      // --- jsdoc tag utils ----------------------------------------------------
      const stripAt = (s) => (s || '').replace(/^@/, '');

      function tsNodeHasJsDocTag(tsNode, tag) {
        if (!ts || !tsNode) return false;
        try {
          const want = stripAt(tag);
          const tags = ts.getJSDocTags(tsNode) || [];
          return tags.some((t) => {
            const n = t.tagName && (t.tagName.escapedText || t.tagName.getText?.());
            return String(n) === want;
          });
        } catch { return false; }
      }

      function leadingCommentsHaveTag(node, tag) {
        if (!node) return false;
        const lead = src.getCommentsBefore(node) || [];
        return lead.some((c) => isCommentWith(c, tag));
      }

      function isExportWrapper(node) {
        return node?.type === 'ExportNamedDeclaration' || node?.type === 'ExportDefaultDeclaration';
      }

      // does a given function *definition* carry tag in its leading comments?
      function fnHasTag(fnNode, tag) {
        if (!fnNode) return false;

        // 1) method definitions: jsdoc sits on the MethodDefinition
        if (fnNode.type === 'MethodDefinition') {
          return leadingCommentsHaveTag(fnNode, tag);
        }

        // 2) function declarations (also handle `export` wrappers)
        if (fnNode.type === 'FunctionDeclaration') {
          if (leadingCommentsHaveTag(fnNode, tag)) return true;
          const p = fnNode.parent;
          if (isExportWrapper(p) && leadingCommentsHaveTag(p, tag)) return true;
          const gp = p && p.parent;
          if (isExportWrapper(gp) && leadingCommentsHaveTag(gp, tag)) return true; // belt & suspenders
          return false;
        }

        // 3) function/arrow expressions
        if (fnNode.type === 'FunctionExpression' || fnNode.type === 'ArrowFunctionExpression') {
          // tag directly on the expression
          if (leadingCommentsHaveTag(fnNode, tag)) return true;

          const p = fnNode.parent;

          // tag on class members that wrap the fn expr (class fields or methods-as-values)
          if (
            p?.type === 'MethodDefinition' ||
            p?.type === 'PropertyDefinition' ||     // ts/estree: class field
            p?.type === 'ClassProperty'             // older @typescript-eslint
          ) {
            if (leadingCommentsHaveTag(p, tag)) return true;
          }

          // tag on a variable declarator (const fn = async () => {})
          if (p?.type === 'VariableDeclarator') {
            if (leadingCommentsHaveTag(p, tag)) return true;
            if (p.parent && leadingCommentsHaveTag(p.parent, tag)) return true; // VariableDeclaration
            // handle: export const fn = async () => {}
            const exp = p.parent && p.parent.parent;
            if (isExportWrapper(exp) && leadingCommentsHaveTag(exp, tag)) return true;
          }

          // handle: export default (async () => {...})  or export default (async function(){})
          if (isExportWrapper(p) && leadingCommentsHaveTag(p, tag)) return true;
        }

        return false;
      }


      // nearest class body ancestor (if any)
      function nearestClassBody() {
        const anc = context.getAncestors();
        for (let i = anc.length - 1; i >= 0; i--) {
          if (anc[i]?.type === 'ClassBody') return anc[i];
        }
        return null;
      }

      // within the same class, find a method by name
      function findMethodInCurrentClass(propertyName) {
        const body = nearestClassBody();
        if (!body) return null;
        for (const el of body.body || []) {
          if (el?.type === 'MethodDefinition') {
            // only handle simple identifiers (not computed) rn
            if (el.key?.type === 'Identifier' && el.key.name === propertyName) return el;
          }
        }
        return null;
      }

      // nearest function ancestor
      function nearestFn() {
        const anc = context.getAncestors();
        for (let i = anc.length - 1; i >= 0; i--) if (isFnNode(anc[i])) return anc[i];
        return null;
      }

      // nearest block or program ancestor
      function nearestBlockOrProgram() {
        const anc = context.getAncestors();
        for (let i = anc.length - 1; i >= 0; i--) {
          const a = anc[i];
          if (a?.type === 'BlockStatement' || a?.type === 'Program') return a;
        }
        return null;
      }

      // context is @asyncUnsafe if the function has the tag OR there is a tagged comment earlier in the same block/program
      function contextIsAnnotatedUnsafe(node) {
        const fn = nearestFn();
        if (fnHasTag(fn, opt.unsafeTag)) return true;

        const blk = nearestBlockOrProgram();
        if (!blk) return false;
        const lead = src.getCommentsBefore(node) || [];
        return lead.some((c) => isCommentWith(c, opt.unsafeTag) && inside(c, blk) && before(c, node));
      }

      // in try { ... } ?
      function inTryBlock(node) {
        const anc = context.getAncestors();
        for (let i = anc.length - 1; i >= 0; i--) {
          const a = anc[i];
          if (a?.type === 'TryStatement' && a.block && inside(node, a.block)) return true;
        }
        return false;
      }

      const unwrapChain = (e) => (e && e.type === 'ChainExpression' ? e.expression : e);

      function isHandledAwaitArg(node) {
        const arg = unwrapChain(node.argument);
        if (!arg) return false;

        // await Promise.allSettled(...)
        if (
          opt.allowAllSettled &&
          arg.type === 'CallExpression' &&
          arg.callee?.type === 'MemberExpression' &&
          arg.callee.object?.type === 'Identifier' &&
          arg.callee.object.name === 'Promise' &&
          arg.callee.property?.type === 'Identifier' &&
          arg.callee.property.name === 'allSettled'
        ) return true;

        // await p.catch(...)
        if (
          opt.allowCatchMethod &&
          arg.type === 'CallExpression' &&
          arg.callee?.type === 'MemberExpression' &&
          arg.callee.property?.type === 'Identifier' &&
          arg.callee.property.name === 'catch'
        ) return true;

        // await p.then(onFulfilled, onRejected)
        if (
          opt.allowThenWithTwoArgs &&
          arg.type === 'CallExpression' &&
          arg.callee?.type === 'MemberExpression' &&
          arg.callee.property?.type === 'Identifier' &&
          arg.callee.property.name === 'then' &&
          Array.isArray(arg.arguments) &&
          arg.arguments.length >= 2
        ) return true;

        return false;
      }

      // resolve identifier → local function def in scope (best-effort)
      function resolveFnFromIdentifier(id) {
        const name = id?.name;
        if (!name) return null;
        let scope = context.getScope();
        while (scope) {
          const v = (scope.set && scope.set.get(name)) || scope.variables?.find((vv) => vv.name === name);
          if (v && v.defs && v.defs.length) {
            for (const d of v.defs) {
              const dn = d.node;
              if (!dn) continue;
              if (dn.type === 'FunctionDeclaration') return dn;
              if (dn.type === 'VariableDeclarator') {
                const init = dn.init;
                if (init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
                  return init;
                }
              }
            }
          }
          scope = scope.upper;
        }
        return null;
      }

      // typescript-powered resolution: member call callee → ts declarations → jsdoc tags
      function tsMemberIsAnnotatedSafe(memberExpr) {
        if (!ts || !checker || !es2ts) return false;
        const prop = memberExpr.property;
        if (!prop || prop.type !== 'Identifier') return false; // skip computed/strings rn

        try {
          const tsObj = es2ts.get(unwrapChain(memberExpr.object));
          if (!tsObj) return false;
          let type = checker.getTypeAtLocation(tsObj);
          if (!type) return false;
          // normalize to apparent type (unions, etc.)
          const apparent = checker.getApparentType ? checker.getApparentType(type) : type;
          const name = prop.name;

          // ts <5 vs >=5 api differences
          const sym = (apparent.getProperty && apparent.getProperty(name)) ||
                      (checker.getPropertyOfType && checker.getPropertyOfType(apparent, name));
          if (!sym || !Array.isArray(sym.declarations)) return false;

          for (const decl of sym.declarations) {
            // method, function, property with function type — accept any with @asyncSafe
            if (tsNodeHasJsDocTag(decl, opt.safeTag)) return true;
            // for class methods, also check the parent (sometimes the tag is on the signature)
            if (decl.parent && tsNodeHasJsDocTag(decl.parent, opt.safeTag)) return true;
          }
        } catch { /* ignore */ }
        return false;
      }

      // estree-only: this.method() inside same class
      function thisMethodIsAnnotatedSafe(memberExpr) {
        if (memberExpr.object?.type !== 'ThisExpression') return false;
        const prop = memberExpr.property;
        if (!prop || prop.type !== 'Identifier') return false;
        const m = findMethodInCurrentClass(prop.name);
        return fnHasTag(m, opt.safeTag);
      }

      function calleeIsAnnotatedSafe(callExpr) {
        const arg = unwrapChain(callExpr);
        if (!arg) return false;

        if (arg.type === 'CallExpression') {
          const c = unwrapChain(arg.callee);
          if (!c) return false;

          // direct identifier call
          if (c.type === 'Identifier') {
            const def = resolveFnFromIdentifier(c);
            if (fnHasTag(def, opt.safeTag)) return true;

            // ts fallback for imported funcs
            if (ts && checker && es2ts) {
              try {
                const tsCallee = es2ts.get(c);
                const sym = checker.getSymbolAtLocation?.(tsCallee);
                const decls = sym?.declarations || [];
                for (const d of decls) {
                  if (tsNodeHasJsDocTag(d, opt.safeTag) || (d.parent && tsNodeHasJsDocTag(d.parent, opt.safeTag))) {
                    return true;
                  }
                }
              } catch { /* noop */ }
            }
            return false;
          }

          // member call: this.m(), obj.m()
          if (c.type === 'MemberExpression') {
            // 1) easy path: this.method inside same class
            if (thisMethodIsAnnotatedSafe(c)) return true;

            // 2) ts-powered cross-file/class/instance resolution
            if (tsMemberIsAnnotatedSafe(c)) return true;

            return false;
          }

          // function expressions / arrow directly inline
          if (c.type === 'FunctionExpression' || c.type === 'ArrowFunctionExpression') {
            return fnHasTag(c, opt.safeTag);
          }

          // dynamic/new/etc → treat as unsafe
          return false;
        }

        // awaiting a non-call promise value → treat as unsafe
        return false;
      }

      // --- main ---------------------------------------------------------------
      return {
        AwaitExpression(node) {
          // handled patterns → ok
          if (inTryBlock(node) || isHandledAwaitArg(node)) return;

          // callee carries @asyncSafe? → ok anywhere
          if (calleeIsAnnotatedSafe(node.argument)) return;

          // context explicitly @asyncUnsafe? → ok to bubble
          if (contextIsAnnotatedUnsafe(node)) return;

          // default: context is safe, callee is unsafe → error
          context.report({ node, messageId: 'unhandled' });
        },

        // void someAsyncCall() — only allowed if callee is @asyncSafe
        UnaryExpression(node) {
          if (node.operator !== 'void') return;

          const arg = unwrapChain(node.argument);
          if (!arg || arg.type !== 'CallExpression') return;

          // callee carries @asyncSafe? → ok
          if (calleeIsAnnotatedSafe(node.argument)) return;

          // void of non-safe callee → error
          context.report({ node, messageId: 'unhandledVoid' });
        },
      };
    },
  },
};
