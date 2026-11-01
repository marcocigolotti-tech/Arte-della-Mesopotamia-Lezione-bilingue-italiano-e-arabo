'use strict';
const article=document.querySelector('#lesson');
const menu=document.querySelector('#menu');
const viewer=document.querySelector('#viewer');
let section=0;
function paragraph(block){
 const wrap=document.createElement('div');
 if(block.text){
  const p=document.createElement('p');p.textContent=block.text;
  if(/^https?:\/\//.test(block.text)){const a=document.createElement('a');a.href=block.text;a.textContent=block.text;a.target='_blank';a.rel='noopener noreferrer';p.replaceChildren(a);}
  if(/^Lato della (guerra|pace)$/.test(block.text))p.className='caption';
  wrap.append(p);
 }
 for(const pic of block.images){
  const figure=document.createElement('figure');const button=document.createElement('button');button.className='image-button';button.setAttribute('aria-label','Ingrandisci: '+pic.alt);
  const img=document.createElement('img');img.src=pic.src;img.alt=pic.alt;img.loading='lazy';button.append(img);
  button.onclick=()=>{document.querySelector('#large').src=pic.src;document.querySelector('#large').alt=pic.alt;document.querySelector('#caption').textContent=pic.alt;viewer.showModal();};figure.append(button);wrap.append(figure);
 }
 return wrap;
}
function render(block,nested=false){
 if(block.type==='p')return paragraph(block);
 const container=document.createElement('div');container.className='bilingual-table';
 const heading=block.rows[0]?.[0]?.find(x=>x.type==='p')?.text||'';
 const isSection=/^\d+\. /.test(heading)&&block.rows.length>1&&!heading.includes(' — ');
 if(isSection){container.classList.add('section');container.id='sezione-'+(++section);const a=document.createElement('a');a.href='#'+container.id;a.textContent=heading;menu.append(a);}
 block.rows.forEach((row,i)=>{
  const line=document.createElement('div');line.className='row';if(row.length===1)line.classList.add('single');
  if(isSection&&i===0)line.classList.add('section-title');
  row.forEach((cell,col)=>{const c=document.createElement('div');c.className='cell';
   const txt=cell.map(b=>b.text||'').join(' ');
   if(col===1&&/[\u0600-\u06ff]/.test(txt)){c.lang='ar';c.dir='rtl';}
   if(isSection&&i===0){const h=document.createElement('h2');h.textContent=txt;c.append(h);}else cell.forEach(b=>c.append(render(b,true)));
   line.append(c);
  });container.append(line);
 });return container;
}
// Il titolo e i crediti sono già presenti nell’intestazione della pagina.
lessonData.slice(4).forEach(b=>{if(b.type==='p'&&!b.text&&!b.images.length)return;article.append(render(b));});
document.querySelector('#close').onclick=()=>viewer.close();
viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close();});
document.querySelector('#size').onclick=e=>{const active=document.body.classList.toggle('large-text');e.target.textContent=active?'Testo normale':'Aumenta testo';e.target.setAttribute('aria-pressed',String(active));};
document.querySelector('#print').onclick=()=>window.print();
