import {readFile,writeFile} from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';
const url=new URL('../packages/protocol/allocator.ts',import.meta.url);
await writeFile(new URL('../packages/protocol/allocator.mjs',import.meta.url),stripTypeScriptTypes(await readFile(url,'utf8'),{mode:'transform'}));
console.log('Allocator TypeScript transformed locally.');
