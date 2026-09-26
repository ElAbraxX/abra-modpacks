const copyServerButton=document.getElementById('copy-server');
copyServerButton?.addEventListener('click',async()=>{
  const feedback=document.getElementById('server-copy-status');
  try{
    await navigator.clipboard.writeText('Pandarmy.shock.gg');
    feedback.textContent='Dirección copiada. Pégala en Minecraft → Multijugador → Añadir servidor.';
  }catch{
    feedback.textContent='No se pudo copiar automáticamente. Selecciona y copia la dirección: Pandarmy.shock.gg';
  }
});
