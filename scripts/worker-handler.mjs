// Included by build-worker.mjs with the HTML and shared gateway implementation.
let activeKey, activeGateway;
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type',
  'Access-Control-Expose-Headers':'Retry-After',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'
};
function workerJson(status,data){return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8',...(status===429?{'Retry-After':'6'}:{})}});}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')) {
      if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
      if(request.method!=='GET') return workerJson(405,{error:{code:'METHOD_NOT_ALLOWED'}});
      if(url.pathname==='/api/health') return workerJson(200,{proxyConfigured:Boolean(env.DIFY_API_KEY?.trim()),service:'oquiz',version:'2.1.0'});
      if(url.pathname!=='/api/quiz') return workerJson(404,{error:{code:'NOT_FOUND'}});
      try {
        if(!activeGateway || activeKey!==env.DIFY_API_KEY) {
          activeGateway=createDifyGateway({env}); activeKey=env.DIFY_API_KEY;
        }
        return workerJson(200,await activeGateway.run(url.searchParams));
      } catch(error) {
        return workerJson(error instanceof GatewayError?error.status:500,{error:{code:error instanceof GatewayError?error.code:'INTERNAL_ERROR'},meta:error instanceof GatewayError?error.meta:{source:'proxy',layer:'gateway'}});
      }
    }
    if(request.method!=='GET'&&request.method!=='HEAD') return new Response('Method not allowed',{status:405});
    if(url.pathname==='/'||url.pathname==='/index.html'||url.pathname==='/oquiz.html') return new Response(request.method==='HEAD'?null:WEB_APP_HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache',...(url.pathname==='/oquiz.html'?{'Content-Disposition':'attachment; filename="oquiz.html"'}:{})}});
    return new Response('Not found',{status:404});
  }
};
