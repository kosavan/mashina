import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const html=readFileSync('dist/index.html','utf8');
const entry=[...html.matchAll(/src="(\/assets\/[^\"]+\.js)"/g)][0]?.[1];
// Vite's assets directory contains public build output, including lazy chunks
// and local fonts. Index HTML alone only names the entry JS and CSS.
function assets(directory, prefix='/assets') {
  return readdirSync(directory,{withFileTypes:true}).flatMap(item=>
    item.isDirectory() ? assets(join(directory,item.name),`${prefix}/${item.name}`)
      : [`${prefix}/${item.name}`]);
}
const paths=assets('dist/assets').sort();
const template=readFileSync('public/sw.js','utf8');
const publicPaths=[...template.match(/const PRECACHE=\[([^\]]+)\]/)[1].matchAll(/['"]([^'"]+)['"]/g)]
  .map(match=>match[1]).filter(path=>path!=='/'&&path!=='/index.html');
const size=entry?gzipSync(readFileSync('dist'+entry)).length:0;
if(size>180*1024)throw new Error(`Entry JS exceeds 180KB gzip: ${size}`);
const hash=createHash('sha256').update(html);
for(const path of paths)hash.update(path).update(readFileSync('dist'+path));
for(const path of publicPaths)hash.update(path).update(readFileSync('dist'+path));
hash.update(template);
let worker=template.replace("'mashina-dev'",`'mashina-${hash.digest('hex').slice(0,12)}'`);
worker=worker.replace("'/index.html',",`'/index.html',${paths.map(p=>JSON.stringify(p)).join(',')},`);
writeFileSync('dist/sw.js',worker);
console.log(`App shell precached. Entry gzip: ${(size/1024).toFixed(1)} KB / 180 KB budget.`);
