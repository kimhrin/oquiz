import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const envPath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.env');
let muted=true;
const output=new Writable({write(chunk,encoding,done){if(!muted)process.stdout.write(chunk);done();}});
const input=createInterface({input:process.stdin,output,terminal:true});
process.stdout.write('Dify app API key (input hidden): ');
try {
  let key=(await input.question('')).trim();
  muted=false;process.stdout.write('\n');
  if(!/^app-[A-Za-z0-9_-]+$/.test(key))throw Error('Invalid Dify app key. Nothing saved.');
  let old='DIFY_API_BASE_URL=https://api.dify.ai/v1\n';
  try{old=await readFile(envPath,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  const lines=old.split(/\r?\n/).filter(line=>line&&!line.startsWith('DIFY_API_KEY='));
  lines.push('DIFY_API_KEY='+key);
  await writeFile(envPath,lines.join('\n')+'\n','utf8');key='';
  console.log('Saved locally. The key was not printed and is excluded from downloads.');
}catch(error){console.error(error.message);process.exitCode=1;}
finally{input.close();}
