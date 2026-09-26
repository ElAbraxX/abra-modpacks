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
function packCover(pack){
  const cover=element('div','◇','cover');
  if(pack.image){
    const img=document.createElement('img');img.alt='Portada de '+pack.name;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
    img.addEventListener('error',()=>{cover.textContent='◇';},{once:true});
    img.src=pack.image;cover.replaceChildren(img);
  }
  return cover;
}
let launcherGuideId=0;
function alternativeLauncherGuide(body,pack){
  const button=element('button','Launcher no premium','outline');button.type='button';
  const guide=element('div');guide.id='launcher-guide-'+(++launcherGuideId);guide.hidden=true;
  button.setAttribute('aria-controls',guide.id);button.setAttribute('aria-expanded','false');
  button.addEventListener('click',()=>{guide.hidden=!guide.hidden;button.setAttribute('aria-expanded',String(!guide.hidden));});
  guide.append(element('p','Elige tu launcher. Estas instrucciones preparan los mods; el acceso al servidor depende de las cuentas que acepte.','muted'));
  const format=pack.format==='modrinth'?'.mrpack':'ZIP de CurseForge';
  const sections=[
    ['SKlauncher',[
      'Descarga el '+format+' de esta tarjeta.',
      'En el gestor de instalaciones busca la opción de importar un modpack. Si tu versión admite este formato, selecciona el archivo descargado y espera a que termine.',
      'Si no aparece la opción o rechaza el archivo, usa el método manual de abajo. No basta con cambiar la extensión del archivo.',
      'Abre la instalación del pack y comprueba que Minecraft y el cargador coincidan con los indicados en la publicación.'
    ]],
    ['TLauncher y otros · método manual',[
      'Primero prepara el pack completo: importa el '+format+' en '+(pack.format==='modrinth'?'Modrinth App o Prism':'CurseForge App o Prism')+' y espera a que descargue los mods. Abre la carpeta de esa instancia.',
      'En tu launcher crea una instalación separada con la misma versión de Minecraft y del cargador (Forge, NeoForge, Fabric o Quilt). Si no admite ese cargador, usa otro compatible.',
      'Abre la carpeta de juego de esa instalación y cierra el juego. Copia desde el pack preparado las carpetas mods, config y las demás carpetas de contenido que incluya, como resourcepacks, shaderpacks, scripts o kubejs. No mezcles mods de otros packs.',
      'Selecciona esa instalación para jugar. Si tu launcher permite elegir el directorio del juego, asegúrate de que apunta a la carpeta donde copiaste el pack.'
    ]]
  ];
  if(pack.format==='modrinth'){
    sections.unshift(['Instalador Abra · Windows',[
      'Método probado por el administrador con un launcher no premium. La selección de la carpeta y del perfil puede variar según tu launcher.',
      'Descarga el .mrpack de esta tarjeta y el Instalador Windows. Abre el instalador, elige el .mrpack y pulsa Instalar.',
      'Espera a que termine y anota la carpeta de destino que muestra. El pack se guarda en una subcarpeta de %APPDATA%\\.minecraft\\abra-packs.',
      'Abre tu launcher y selecciona el perfil del pack si aparece. Si no aparece, crea una instalación con la misma versión de Minecraft y del cargador del pack, y configura su directorio de juego con la carpeta de destino completa que mostró el instalador.',
      'No selecciones solo .minecraft ni abra-packs: selecciona la subcarpeta de ese pack. Inicia el juego y comprueba que carga los mods. Si tu launcher no permite elegir esa carpeta o ese cargador, utiliza una de las otras guías.'
    ]]);
  }
  for(const [title,steps] of sections){guide.append(element('h4',title));const list=element('ol');for(const step of steps)list.append(element('li',step));guide.append(list);}
  guide.append(element('p','No pongas el '+format+' directamente en mods: puede contener una lista de descargas y no todos los archivos. El instalador Abra solo admite .mrpack; para ZIP de CurseForge utiliza las guías de importación.','muted'));
  for(const [title,url] of [['Ayuda oficial de SKlauncher','https://docs.skmedix.pl/4.0/'],['Guía de mods de TLauncher','https://tlauncher.org/en/install-mods.html']]){const a=link(title+' ↗',url,'text-link');a.target='_blank';a.rel='noopener noreferrer';guide.append(a);}
  body.append(button,guide);
}
function launcherLinks(body,pack){
  const launchers=pack.format==='modrinth'?[['Modrinth App','https://modrinth.com/app'],['Prism Launcher','https://prismlauncher.org/download/']]:[['Prism Launcher','https://prismlauncher.org/download/']];
  for(const [name,url] of launchers){
    const a=link('Descargar '+name+' ↗',url,'outline');a.target='_blank';a.rel='noopener noreferrer';body.append(a);
  }
  body.append(element('p',pack.format==='modrinth'?'Compatible con Modrinth, Prism y el instalador Abra.':'Importa este ZIP exportado de CurseForge en CurseForge App o Prism.','muted'));
  const help=link('Cómo instalar este formato','#install','text-link');
  help.addEventListener('click',()=>{view('install');document.getElementById(pack.format==='modrinth'?'guide-mrpack':'guide-curseforge').scrollIntoView({behavior:'smooth'});});
  body.append(help);
  alternativeLauncherGuide(body,pack);
}
async function load(){
  const results=await Promise.allSettled([request('/site-config.json'),request('/api/session'),request('/api/catalog')]);
  if(results[0].status==='fulfilled'){const theme=results[0].value;applyTheme(theme);for(const field of ['name','intro','color','background'])$('theme-form').elements[field].value=theme[field];}
  if(results[1].status==='fulfilled'){const session=results[1].value;admin=session.admin;$('admin-tab').hidden=$('logout').hidden=!admin;$('login').hidden=admin;$('identity').textContent=admin?'Sesión de administrador: '+session.login:'';if(!session.configured){$('login').addEventListener('click',e=>{e.preventDefault();message('notice','La colección es pública. Falta completar la configuración de GitHub en Cloudflare para activar la administración.');});}}
  if(results[2].status==='fulfilled'){
    if(results[2].value.stale)message('notice',results[2].value.notice);
    const packs=results[2].value.packs;$('empty').hidden=packs.length>0;
    const groups={};
    $('cards').className='';
    for(const [format,title,description] of [['zip','CurseForge · ZIP','Instala estos packs con CurseForge App o Prism Launcher.'],['modrinth','Modrinth · MRPACK','Instala estos packs con Modrinth App, Prism Launcher o Abra para Windows.']]){
      if(!packs.some(p=>(p.format==='modrinth'?'modrinth':'zip')===format))continue;
      const section=element('section');section.append(element('h2',title),element('p',description,'muted'));groups[format]=element('div',null,'cards');section.append(groups[format]);$('cards').append(section);
    }
    for(const p of packs){const card=element('article',null,'card'),body=element('div',null,'card-body');card.append(packCover(p));body.append(element('span',p.format==='modrinth'?'MODRINTH · .MRPACK':'CURSEFORGE · .ZIP','eyebrow'),element('h3',p.name),element('p',p.description||'Listo para tu próxima partida.'),element('small',`${(p.size/1024/1024).toFixed(1)} MB · ${p.file}`),link(p.format==='modrinth'?'Descargar .mrpack ↓':'Descargar ZIP de CurseForge ↓',p.url,'primary'));if(p.format==='modrinth'){body.append(link('Instalador Windows','/Abra-Instalador.exe','outline'));}else{const a=link('Instalar con CurseForge ↗','https://www.curseforge.com/download/app','outline');a.target='_blank';a.rel='noopener noreferrer';body.append(a);}launcherLinks(body,p);const source=link('Ver publicación ↗',p.release,'text-link');source.target='_blank';source.rel='noopener noreferrer';body.append(source);card.append(body);groups[p.format==='modrinth'?'modrinth':'zip'].append(card);}
  }else{message('error',results[2].reason.message+' Puedes usar el enlace «Ver todas las publicaciones en GitHub».');}
  $('loading').hidden=true;view(location.hash.slice(1));
  if(new URLSearchParams(location.search).get('login')==='denied')message('error','Esa cuenta puede descargar, pero no administrar esta página. Entra con la cuenta del propietario.');
}
$('logout').addEventListener('click',async()=>{try{const r=await fetch('/api/logout',{method:'POST'});if(!r.ok)throw Error('No se pudo cerrar la sesión.');location.href='/';}catch(e){message('error',e.message);}});
$('theme-form').addEventListener('submit',async e=>{e.preventDefault();$('save').disabled=true;message('error','');try{const theme=Object.fromEntries(new FormData(e.currentTarget));const result=await request('/api/admin/theme',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(theme)});applyTheme(result.theme);message('notice',result.message);}catch(e){message('error',e.message);}finally{$('save').disabled=false;}});
void load();
