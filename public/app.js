const $=id=>document.getElementById(id);
let admin=false;
function message(id,text){$(id).textContent=text;$(id).hidden=!text;}
async function request(url,options){const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo completar la operación.');return data;}
function contrast(hex){const values=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*values[0]+.7152*values[1]+.0722*values[2]>.179?'#101311':'#f4f7ef';}
function applyTheme(theme){for(const field of ['color','background'])if(!/^#[a-f\d]{6}$/i.test(theme[field]))return;document.documentElement.style.setProperty('--brand',theme.color);document.documentElement.style.setProperty('--page',theme.background);document.documentElement.style.setProperty('--ink',contrast(theme.background));document.documentElement.style.setProperty('--button-ink',contrast(theme.color));$('brand').textContent=$('footer-name').textContent=theme.name;$('intro').textContent=theme.intro;document.title=theme.name;}
function view(name){if(!['packs','install','admin'].includes(name)||name==='admin'&&!admin)name='packs';for(const id of ['packs','install','admin'])$(id).hidden=id!==name;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.view;view(b.dataset.view);}));window.addEventListener('hashchange',()=>view(location.hash.slice(1)));
function element(tag,text,className){const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;}
function link(text,url,className){const a=element('a',text,className);a.href=url;return a;}
async function load(){
  const results=await Promise.allSettled([request('/site-config.json'),request('/api/session'),request('/api/catalog')]);
  if(results[0].status==='fulfilled'){const theme=results[0].value;applyTheme(theme);for(const field of ['name','intro','color','background'])$('theme-form').elements[field].value=theme[field];}
  if(results[1].status==='fulfilled'){const session=results[1].value;admin=session.admin;$('admin-tab').hidden=$('logout').hidden=!admin;$('login').hidden=admin;$('identity').textContent=admin?'Sesión de administrador: '+session.login:'';if(!session.configured){$('login').addEventListener('click',e=>{e.preventDefault();message('notice','La colección es pública. Falta completar la configuración de GitHub en Cloudflare para activar la administración.');});}}
  if(results[2].status==='fulfilled'){
    const packs=results[2].value.packs;$('empty').hidden=packs.length>0;
    for(const p of packs){const card=element('article',null,'card'),body=element('div',null,'card-body');card.append(element('div','◇','cover'));body.append(element('span',p.format==='modrinth'?'MODRINTH · .MRPACK':'ARCHIVO .ZIP','eyebrow'),element('h3',p.name),element('p',p.description||'Listo para tu próxima partida.'),element('small',`${(p.size/1024/1024).toFixed(1)} MB · ${p.file}`),link('Descargar modpack ↓',p.url,'primary'));if(p.format==='modrinth'){body.append(link('Instalador Windows','/Abra-Instalador.exe','outline'));}else{const a=link('Instalar con CurseForge ↗','https://www.curseforge.com/download/app','outline');a.target='_blank';a.rel='noopener noreferrer';body.append(a);}const source=link('Ver publicación ↗',p.release,'text-link');source.target='_blank';source.rel='noopener noreferrer';body.append(source);card.append(body);$('cards').append(card);}
  }else{message('error',results[2].reason.message+' Puedes usar el enlace «Ver todas las publicaciones en GitHub».');}
  $('loading').hidden=true;view(location.hash.slice(1));
  if(new URLSearchParams(location.search).get('login')==='denied')message('error','Esa cuenta puede descargar, pero no administrar esta página. Entra con la cuenta del propietario.');
}
$('logout').addEventListener('click',async()=>{try{const r=await fetch('/api/logout',{method:'POST'});if(!r.ok)throw Error('No se pudo cerrar la sesión.');location.href='/';}catch(e){message('error',e.message);}});
$('theme-form').addEventListener('submit',async e=>{e.preventDefault();$('save').disabled=true;message('error','');try{const theme=Object.fromEntries(new FormData(e.currentTarget));const result=await request('/api/admin/theme',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(theme)});applyTheme(result.theme);message('notice',result.message);}catch(e){message('error',e.message);}finally{$('save').disabled=false;}});
void load();
