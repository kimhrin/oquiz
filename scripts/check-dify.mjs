import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDifyGateway,GatewayError} from './dify-gateway.mjs';
try {process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.env'));}
catch(error){if(error.code!=='ENOENT') throw error;}
try {
  const result=await createDifyGateway().run(new URLSearchParams({category:'18',difficulty:'easy'}));
  console.log(JSON.stringify({verified:true,...result.meta},null,2));
} catch(error) {
  console.error(JSON.stringify({verified:false,code:error instanceof GatewayError?error.code:'INTERNAL_ERROR',meta:error instanceof GatewayError?error.meta:{}},null,2));
  process.exitCode=1;
}
