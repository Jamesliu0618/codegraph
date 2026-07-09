const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

function copyCore() {
  const coreSrc = path.join(__dirname, '../src');
  const coreDest = path.join(__dirname, 'src/core');
  if (fs.existsSync(coreSrc)) {
    fs.rmSync(coreDest, { recursive: true, force: true });
    fs.mkdirSync(coreDest, { recursive: true });
    fs.cpSync(coreSrc, coreDest, {
      recursive: true,
      filter: (src) => {
        const rel = path.relative(coreSrc, src);
        return !rel.startsWith('bin') && !rel.startsWith('ui') && !rel.startsWith('installer');
      }
    });
    console.log('Successfully copied core src to vscode-extension/src/core');
  }
}

async function main() {
  copyCore();
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

            // Copy WebView media assets (CSS/JS for the Graph View)
            // src/gui/media/* -> dist/media/* so the packaged .vsix
            // includes them (vscodeignore excludes src/**).
            const mediaSrc = path.join(__dirname, 'src/gui/media');
            const mediaDest = path.join(__dirname, 'dist/media');
            if (fs.existsSync(mediaSrc)) {
              fs.mkdirSync(mediaDest, { recursive: true });
              fs.readdirSync(mediaSrc).forEach(f => {
                const srcFile = path.join(mediaSrc, f);
                const destFile = path.join(mediaDest, f);
                if (fs.statSync(srcFile).isFile()) {
                  fs.copyFileSync(srcFile, destFile);
                }
              });
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
