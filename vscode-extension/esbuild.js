const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'info',
    plugins: [
      {
        name: 'copy-wasm',
        setup(build) {
          build.onEnd(() => {
            // Copy tree-sitter WASM files
            const wasmSrc = path.join(__dirname, 'node_modules/tree-sitter-wasms/out');
            const wasmDest = path.join(__dirname, 'dist/wasm');
            if (fs.existsSync(wasmSrc)) {
              fs.mkdirSync(wasmDest, { recursive: true });
              fs.readdirSync(wasmSrc).forEach(f => {
                if (f.endsWith('.wasm')) {
                  fs.copyFileSync(path.join(wasmSrc, f), path.join(wasmDest, f));
                }
              });
            }
            // Copy schema.sql
            const schemaSrc = path.join(__dirname, 'src/core/db/schema.sql');
            const schemaDest = path.join(__dirname, 'dist/schema.sql');
            if (fs.existsSync(schemaSrc)) {
              fs.copyFileSync(schemaSrc, schemaDest);
            }
          });
        },
      },
    ],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
