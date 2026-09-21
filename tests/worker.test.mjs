import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{seal,unseal,packsFromReleases,validateTheme} from '../worker.mjs';
const env={GITHUB_OWNER:'wil71490-png',GITHUB_REPO:'abra-modpacks',ADMIN_LOGIN:'wil71490-png',SESSION_SECRET:'a-strong-test-only-secret-at-least-32-characters',GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'test-secret'};
const ctx={waitUntil(){}};
const asset={id:1,name:'Aventura.zip',size:1024**3,state:'uploaded',browser_download_url:'https://github.com/wil71490-png/abra-modpacks/releases/download/v1/Aventura.zip'};
test('public catalog accepts 1 GiB and excludes drafts, executables, oversize and foreign links',()=>{
 const releases=[{name:'Mi aventura',tag_name:'v1',assets:[asset,{...asset,size:1024**3+1},{...asset,name:'bad.exe'},{...asset,browser_download_url:'https://evil.example/Aventura.zip'}]},{draft:true,assets:[asset]},{prerelease:true,assets:[asset]}];
 const packs=packsFromReleases(releases,env);assert.equal(packs.length,1);assert.equal(packs[0].name,'Mi aventura');
});
test('encrypted session expires and rejects tampering, wrong key and wrong account',async()=>{
 const encrypted=await seal({kind:'session',login:'other-user',token:'secret-token',exp:Date.now()+60000},env);
 assert.ok(!encrypted.includes('secret-token'));
 assert.equal(await unseal(encrypted+'!',env),null);
 assert.equal(await unseal(encrypted,{...env,SESSION_SECRET:'another-secret-value-that-is-long-enough'}),null);
 assert.equal(await unseal(await seal({exp:Date.now()-1},env),env),null);
 const r=await worker.fetch(new Request('https://example.test/api/session',{headers:{Cookie:'__Host-abra_session='+encrypted}}),env,ctx);assert.equal((await r.json()).admin,false);
});
test('anonymous and cross-origin writes fail before any GitHub requests',async()=>{
 for(const origin of ['https://example.test','https://evil.test']) {
 const r=await worker.fetch(new Request('https://example.test/api/admin/theme',{method:'PUT',headers:{Origin:origin},body:'{}'}),env,ctx);assert.equal(r.status,403);
 }
});
test('OAuth uses PKCE and secure flow cookie; callback requires matching state',async()=>{
 const start=await worker.fetch(new Request('https://example.test/auth/login'),env,ctx);
 const target=new URL(start.headers.get('Location'));assert.equal(target.searchParams.get('code_challenge_method'),'S256');assert.ok(target.searchParams.get('state'));
 assert.match(start.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);
 const r=await worker.fetch(new Request('https://example.test/auth/callback?code=test&state=wrong'),env,ctx);assert.equal(r.status,403);
});
test('theme validation rejects injection and empty names',()=>{
 assert.throws(()=>validateTheme({name:'',intro:'hey',color:'#ffffff',background:'#000000'}));
 assert.throws(()=>validateTheme({name:'Test',intro:'hey',color:'url(javascript:bad)',background:'#000000'}));
 assert.equal(validateTheme({name:'  PandArmy  ',intro:'Hola',color:'#b6ef55',background:'#101311'}).name,'PandArmy');
});
test('owner theme write validates GitHub identity, preserves file SHA and Unicode',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});if(url.endsWith('/user'))return Response.json({id:42,login:'wil71490-png'});if(options.method==='PUT')return Response.json({});return Response.json({sha:'existing-sha'});};
 try{
 const session=await seal({kind:'session',login:'wil71490-png',id:42,token:'owner-token',exp:Date.now()+60000},env);
 const r=await worker.fetch(new Request('https://example.test/api/admin/theme',{method:'PUT',headers:{Origin:'https://example.test',Cookie:'__Host-abra_session='+session},body:JSON.stringify({name:'Aventura á 🌲',intro:'Hola',color:'#b6ef55',background:'#101311'})}),env,ctx);
 assert.equal(r.status,200);const written=JSON.parse(calls.at(-1).options.body);assert.equal(written.sha,'existing-sha');assert.match(Buffer.from(written.content,'base64').toString('utf8'),/Aventura á 🌲/);assert.equal(calls.at(-1).options.headers.Authorization,'Bearer owner-token');
 }finally{globalThis.fetch=original;}
});
test('unconfigured auth fails closed while anonymous session remains available',async()=>{
 const noSecrets={...env,GITHUB_CLIENT_SECRET:undefined,SESSION_SECRET:undefined};
 assert.equal((await worker.fetch(new Request('https://example.test/auth/login'),noSecrets,ctx)).status,503);
 const response=await worker.fetch(new Request('https://example.test/api/session'),noSecrets,ctx);assert.deepEqual(await response.json(),{admin:false,login:null,configured:false});
});
