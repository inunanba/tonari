import {readFile,writeFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('vendor/qrcodegen.ts',root),'utf8');
const compiled=stripTypeScriptTypes(source,{mode:'transform'})+'\nexport {qrcodegen};\n';
await writeFile(new URL('vendor/qrcodegen.mjs',root),compiled);
const decoder=await readFile(new URL('vendor/jsqr-upstream.cjs',root),'utf8');
// Preserve the upstream distribution verbatim inside a local ESM adapter.
await writeFile(new URL('vendor/jsqr.mjs',root),'// jsQR 1.4.0, Apache-2.0; see jsqr-LICENSE. ESM adapter added by TONARI.\nconst module={exports:{}};const exports=module.exports;\n'+decoder+'\nexport default module.exports;\n');
console.log('Local QR vendor build complete (Node24 type transformation; no download).');
