const encoder = new TextEncoder();
const MAX_PACK = 1024 ** 3;
const SESSION = '__Host-abra_session';
const FLOW = '__Host-abra_oauth';
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function b64(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''); }
function unb64(text) { return Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')), c => c.charCodeAt(0)); }
function random() { return b64(crypto.getRandomValues(new Uint8Array(32))); }
async function key(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new HttpError(503,'Falta configurar el inicio de sesión en Cloudflare.');
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256',encoder.encode(env.SESSION_SECRET)), 'AES-GCM',false,['encrypt','decrypt']);
}
export async function seal(value, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return b64(iv)+'.'+b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),encoder.encode(JSON.stringify(value)))));
}
export async function unseal(value, env) {
  try {
    const [iv,data] = value.split('.');
    const decoded = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},await key(env),unb64(data))));
    return decoded.exp > Date.now() ? decoded : null;
  } catch { return null; }
}
function cookie(req,name) { return req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||''; }
function setCookie(name,value,seconds) { return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`; }
function redirect(url,cookies=[]) { const headers=new Headers({Location:url,'Cache-Control':'no-store'}); for(const c of cookies)headers.append('Set-Cookie',c); return new Response(null,{status:302,headers}); }
function json(data,status=200) { return Response.json(data,{status,headers:{'Cache-Control':'no-store'}}); }
async function session(req,env) {
  const s=await unseal(cookie(req,SESSION),env);
  return s?.kind==='session' && s.login?.toLowerCase()===env.ADMIN_LOGIN.toLowerCase() ? s : null;
}
function sameOrigin(req) { if(req.headers.get('Origin')!==new URL(req.url).origin)throw new HttpError(403,'Solicitud no permitida.'); }
function repoPath(env) { return `/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}`; }
async function github(path,token,options={}) {
  const headers={'Accept':'application/vnd.github+json','User-Agent':'Abra-Modpacks','X-GitHub-Api-Version':'2022-11-28',...(options.body?{'Content-Type':'application/json'}:{})};
  if(token)headers.Authorization=`Bearer ${token}`;
  const response=await fetch('https://api.github.com'+path,{...options,headers,signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new HttpError(response.status===401?401:502,response.status===401?'Tu sesión de GitHub ha caducado. Vuelve a entrar.':'GitHub no está disponible o ha alcanzado su límite temporal. Inténtalo más tarde.');
  return response.json();
}
export function releasePresentation(body) {
  let image=null;
  const description=String(body||'').replace(/!\[[^\]]*\]\(\s*(https:\/\/[^\s)]+)(?:\s+"[^"]*")?\s*\)|<img\b[^>]*>/gi,(match,markdownUrl)=>{
    const htmlUrl=match.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    try{const url=new URL(markdownUrl||htmlUrl);if(url.protocol==='https:'&&!url.username&&!url.password){image??=url.href;return '';}}catch{}
    return match;
  }).trim().slice(0,2000);
  return {image,description};
}
export function packsFromReleases(releases,env) {
  if(!Array.isArray(releases))throw new HttpError(502,'Respuesta inesperada de GitHub.');
  const prefix=`https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/releases/download/`;
  return releases.filter(r=>!r.draft&&!r.prerelease).flatMap(r=>(r.assets||[]).filter(a=>
    /\.(mrpack|zip)$/i.test(a.name) && a.size>0 && a.size<=MAX_PACK && a.state==='uploaded' && a.browser_download_url?.startsWith(prefix)
  ).map(a=>({id:a.id,name:r.name||r.tag_name,...releasePresentation(r.body),file:a.name,size:a.size,url:a.browser_download_url,
    format:a.name.toLowerCase().endsWith('.mrpack')?'modrinth':'zip',release:`https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/releases/tag/${encodeURIComponent(r.tag_name)}`})));
}
async function catalog(req,env,ctx) {
  const cache=globalThis.caches?.default;
  const cacheKey=new Request(new URL('/api/catalog',req.url));
  const cached=await cache?.match(cacheKey);
  if(cached)return cached;
  // The catalog shows the latest 100 releases; the UI links to the full archive.
  const releases=await github(repoPath(env)+'/releases?per_page=100');
  const response=Response.json({packs:packsFromReleases(releases,env),releasesUrl:`https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/releases`},{headers:{'Cache-Control':'public, max-age=600'}});
  if(cache)ctx.waitUntil(cache.put(cacheKey,response.clone()));
  return response;
}
export function validateTheme(value) {
  if(!value||typeof value!=='object')throw new HttpError(400,'Apariencia no válida.');
  const result={};
  for(const [field,max] of [['name',80],['intro',180]]) {
    if(typeof value[field]!=='string'||!value[field].trim()||value[field].length>max)throw new HttpError(400,'Revisa el nombre y la descripción.');
    result[field]=value[field].trim();
  }
  for(const field of ['color','background']) {
    if(typeof value[field]!=='string'||!/^#[a-f\d]{6}$/i.test(value[field]))throw new HttpError(400,'Color no válido.');
    result[field]=value[field];
  }
  return result;
}
async function route(req,env,ctx) {
  const url=new URL(req.url),path=url.pathname;
  if(path==='/auth/login'&&req.method==='GET') {
    if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET)throw new HttpError(503,'El administrador todavía debe configurar el acceso con GitHub en Cloudflare.');
    const state=random(),verifier=random();
    const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier))));
    const target=new URL('https://github.com/login/oauth/authorize');
    target.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:url.origin+'/auth/callback',scope:'public_repo',state,code_challenge:challenge,code_challenge_method:'S256'});
    return redirect(target.href,[setCookie(FLOW,await seal({kind:'flow',state,verifier,exp:Date.now()+600000},env),600)]);
  }
  if(path==='/auth/callback'&&req.method==='GET') {
    const flow=await unseal(cookie(req,FLOW),env);
    if(!flow||flow.kind!=='flow'||!url.searchParams.get('state')||flow.state!==url.searchParams.get('state')||!url.searchParams.get('code'))throw new HttpError(403,'El acceso caducó o fue cancelado. Vuelve a pulsar Administrar.');
    const response=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:url.searchParams.get('code'),code_verifier:flow.verifier,redirect_uri:url.origin+'/auth/callback'}),signal:AbortSignal.timeout(15000)});
    const token=await response.json();
    if(!response.ok||!token.access_token)throw new HttpError(403,'No se pudo completar el acceso con GitHub.');
    const user=await github('/user',token.access_token);
    if(user.login.toLowerCase()!==env.ADMIN_LOGIN.toLowerCase())return redirect('/?login=denied',[setCookie(FLOW,'',0),setCookie(SESSION,'',0)]);
    const value=await seal({kind:'session',login:user.login,id:user.id,token:token.access_token,exp:Date.now()+3600000},env);
    return redirect('/#admin',[setCookie(SESSION,value,3600),setCookie(FLOW,'',0)]);
  }
  if(path==='/api/session'&&req.method==='GET') {
    const user=await session(req,env);
    return json({admin:!!user,login:user?.login||null,configured:!!(env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET&&env.SESSION_SECRET?.length>=32)});
  }
  if(path==='/api/logout'&&req.method==='POST') {sameOrigin(req);return new Response(null,{status:204,headers:{'Set-Cookie':setCookie(SESSION,'',0),'Cache-Control':'no-store'}});}
  if(path==='/api/catalog'&&req.method==='GET')return catalog(req,env,ctx);
  if(path==='/api/admin/theme'&&req.method==='PUT') {
    sameOrigin(req);
    const user=await session(req,env);if(!user)throw new HttpError(403,'Solo el propietario puede editar.');
    const text=await req.text();if(text.length>2000)throw new HttpError(413,'Formulario demasiado grande.');
    let payload;try{payload=JSON.parse(text);}catch{throw new HttpError(400,'Formulario no válido.');}
    const theme=validateTheme(payload);
    const currentUser=await github('/user',user.token);
    if(currentUser.id!==user.id||currentUser.login.toLowerCase()!==env.ADMIN_LOGIN.toLowerCase())throw new HttpError(403,'La cuenta no está autorizada.');
    const path=repoPath(env)+'/contents/public/site-config.json';
    const current=await github(path,user.token);
    const bytes=encoder.encode(JSON.stringify(theme,null,2)+'\n');
    await github(path,user.token,{method:'PUT',body:JSON.stringify({message:'Actualizar apariencia de la colección',sha:current.sha,content:btoa(String.fromCharCode(...bytes))})});
    return json({theme,message:'Cambios guardados. Cloudflare los publicará al completar el despliegue automático.'});
  }
  if(path.startsWith('/api/')||path.startsWith('/auth/'))throw new HttpError(404,'Ruta no encontrada.');
  return env.ASSETS.fetch(req);
}
export default {async fetch(req,env,ctx) {
  let response;
  try{response=await route(req,env,ctx);}catch(error){response=json({error:error instanceof HttpError?error.message:'No se pudo completar la operación. Inténtalo de nuevo.'},error.status||500);}
  const safe=new Response(response.body,response);
  safe.headers.set('X-Content-Type-Options','nosniff');safe.headers.set('Referrer-Policy','no-referrer');
  safe.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  return safe;
}};
