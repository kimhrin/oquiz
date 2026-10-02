import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=await readFile(path.join(root,'dist/index.html'),'utf8');
const css=await readFile(path.join(root,'dist/styles.css'),'utf8');
const core=(await readFile(path.join(root,'dist/core.js'),'utf8')).replace(/^export /gm,'');
const config=(await readFile(path.join(root,'dist/config.js'),'utf8')).replace(/^export /gm,'');
const data=(await readFile(path.join(root,'dist/data.js'),'utf8')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const app=(await readFile(path.join(root,'dist/app.js'),'utf8')).replace(/^import .*?;\r?\n/gm,'');
const js=`(()=>{\n${config}\n${core}\n${data}\n${app}\n})();`;
const out=html.replace('<link rel="stylesheet" href="./styles.css">',`<style>\n${css}\n</style>`)
 .replace('<script type="module" src="./app.js"></script>','')
 .replace('</body>',`<script>\n${js.replace(/<\/script/gi,'<\\/script')}\n</script></body>`);
await writeFile(path.join(root,'oquiz.html'),out.replace(/\r\n/g,'\n'),'utf8');
console.log('Standalone exported: oquiz.html');
