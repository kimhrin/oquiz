import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDifyGateway, GatewayError} from './dify-gateway.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
try { process.loadEnvFile(path.resolve(root, '../.env')); } catch(error) { if(error.code !== 'ENOENT') throw error; }
const gateway=createDifyGateway();
const port=Number(process.env.PORT || 4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
http.createServer(async(req,res)=>{
  try{
    const allowedHosts=[`127.0.0.1:${port}`,`localhost:${port}`];
    if(!allowedHosts.includes(req.headers.host)) return json(res,403,{error:{code:'FORBIDDEN'}});
    const url=new URL(req.url,'http://localhost');
    const pathname=decodeURIComponent(url.pathname);
    if(pathname.startsWith('/api/')){
      if(req.method!=='GET') return json(res,405,{error:{code:'METHOD_NOT_ALLOWED'}});
      if(req.headers['sec-fetch-site']==='cross-site' || (req.headers.origin && !allowedHosts.some(h=>req.headers.origin===`http://${h}`))) return json(res,403,{error:{code:'FORBIDDEN'}});
      if(pathname==='/api/health') return json(res,200,{proxyConfigured:gateway.configured()});
      if(pathname!=='/api/quiz') return json(res,404,{error:{code:'NOT_FOUND'}});
      try { return json(res,200,await gateway.run(url.searchParams)); }
      catch(error){return json(res,error instanceof GatewayError?error.status:500,{error:{code:error instanceof GatewayError?error.code:'INTERNAL_ERROR'},meta:error instanceof GatewayError?error.meta:{layer:'gateway'}});}
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
    const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    const data=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`OQuiz local server: http://127.0.0.1:${port}`));
