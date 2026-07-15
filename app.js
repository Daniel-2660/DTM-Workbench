"use strict";
const $=id=>document.getElementById(id);let pboUrl=null,textureUrl=null,paaBuildUrl=null,eddsBuildUrl=null;
function revoke(which){if(which==='pbo'&&pboUrl){URL.revokeObjectURL(pboUrl);pboUrl=null}if(which==='texture'&&textureUrl){URL.revokeObjectURL(textureUrl);textureUrl=null}if(which==='paaBuild'&&paaBuildUrl){URL.revokeObjectURL(paaBuildUrl);paaBuildUrl=null}if(which==='eddsBuild'&&eddsBuildUrl){URL.revokeObjectURL(eddsBuildUrl);eddsBuildUrl=null}}
function readCString(bytes,state){const s=state.pos;let e=s;while(e<bytes.length&&bytes[e]!==0)e++;if(e>=bytes.length)throw new Error('PBO-headeren er ugyldig.');state.pos=e+1;let out='';for(let i=s;i<e;i++)out+=String.fromCharCode(bytes[i]);return out}
function readEntry(view,bytes,state){const name=readCString(bytes,state);if(state.pos+20>bytes.length)throw new Error('PBO-headeren er afbrudt.');const p=state.pos,e={name,method:view.getUint32(p,true),originalSize:view.getUint32(p+4,true),reserved:view.getUint32(p+8,true),timestamp:view.getUint32(p+12,true),dataSize:view.getUint32(p+16,true),offset:0};state.pos+=20;return e}
function parsePbo(buffer){const bytes=new Uint8Array(buffer),view=new DataView(buffer),state={pos:0},ext=readEntry(view,bytes,state);if(ext.name!==''||ext.method!==0x56657273)throw new Error('Filen er ikke en understøttet Bohemia PBO.');const properties={};while(true){const k=readCString(bytes,state);if(!k)break;properties[k]=readCString(bytes,state)}const entries=[];while(true){const e=readEntry(view,bytes,state);if(!e.name)break;entries.push(e)}let offset=state.pos;for(const e of entries){e.offset=offset;offset+=e.dataSize;if(offset>bytes.length)throw new Error(`Ugyldige data i ${e.name}`)}const unsupported=entries.filter(e=>e.method!==0);if(unsupported.length)throw new Error(`${unsupported.length} komprimerede filer understøttes ikke endnu.`);return{bytes,properties,entries}}
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0}return t})();function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=crcTable[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}function u16(n){const a=new Uint8Array(2);new DataView(a.buffer).setUint16(0,n,true);return a}function u32(n){const a=new Uint8Array(4);new DataView(a.buffer).setUint32(0,n>>>0,true);return a}function join(...a){const o=new Uint8Array(a.reduce((n,x)=>n+x.length,0));let p=0;for(const x of a){o.set(x,p);p+=x.length}return o}function dt(d=new Date()){const y=Math.max(1980,d.getFullYear());return{t:(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),d:((y-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()}}
async function buildZip(pbo,progress){const enc=new TextEncoder(),parts=[],central=[];let offset=0;const z=dt(),records=pbo.entries.map(e=>({path:e.name.replaceAll('\\','/'),bytes:pbo.bytes.subarray(e.offset,e.offset+e.dataSize)}));if(pbo.properties.prefix)records.unshift({path:'$PBOPREFIX$',bytes:enc.encode(pbo.properties.prefix)});for(let i=0;i<records.length;i++){const r=records[i],name=enc.encode(r.path),crc=crc32(r.bytes),size=r.bytes.length,local=join(u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(z.t),u16(z.d),u32(crc),u32(size),u32(size),u16(name.length),u16(0),name);parts.push(local,r.bytes);central.push(join(u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(z.t),u16(z.d),u32(crc),u32(size),u32(size),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name));offset+=local.length+size;if(i%75===0){progress(i,records.length);await new Promise(r=>setTimeout(r,0))}}const cs=central.reduce((n,a)=>n+a.length,0);parts.push(...central,join(u32(0x06054b50),u16(0),u16(0),u16(records.length),u16(records.length),u32(cs),u32(offset),u16(0)));return new Blob(parts,{type:'application/zip'})}
$('pboInput').addEventListener('change',async()=>{const file=$('pboInput').files[0];if(!file)return;revoke('pbo');$('pboWork').classList.remove('hidden');$('pboDownload').classList.add('hidden');$('pboName').textContent=file.name;$('pboStatus').textContent='Læser PBO…';$('pboBar').style.width='5%';try{const p=parsePbo(await file.arrayBuffer());$('pboStatus').textContent=`${p.entries.length.toLocaleString('da-DK')} filer fundet.`;const blob=await buildZip(p,(i,n)=>{$('pboBar').style.width=`${25+Math.round(65*i/n)}%`;$('pboStatus').textContent=`Pakker fil ${i+1} af ${n}…`});pboUrl=URL.createObjectURL(blob);const a=$('pboDownload');a.href=pboUrl;a.download=file.name.replace(/\.pbo$/i,'')+'_extracted.zip';a.classList.remove('hidden');$('pboBar').style.width='100%';$('pboStatus').textContent='ZIP-filen er klar.'}catch(e){$('pboBar').style.width='0';$('pboStatus').textContent=e.message||String(e)}});
async function convertTexture(file,type){if(!file)return;revoke('texture');$('textureWork').classList.remove('hidden');$('textureDownload').classList.add('hidden');$('textureName').textContent=file.name;$('textureStatus').textContent='Afkoder tekstur…';$('textureMeta').textContent='';const canvas=$('previewCanvas'),ctx=canvas.getContext('2d');try{await new Promise(r=>setTimeout(r,20));const buffer=await file.arrayBuffer();const result=type==='paa'?DTMTextureDecoder.decodePaa(buffer):DTMTextureDecoder.decodeEdds(buffer);
let pixels=new Uint8ClampedArray(result.rgba.buffer,result.rgba.byteOffset,result.rgba.byteLength);
if(type==='paa'){
  const rgba=new Uint8ClampedArray(pixels.length);
  for(let i=0;i<pixels.length;i+=4){
    rgba[i]=pixels[i+2];
    rgba[i+1]=pixels[i+1];
    rgba[i+2]=pixels[i];
    rgba[i+3]=pixels[i+3];
  }
  pixels=rgba;
}
canvas.width=result.width;canvas.height=result.height;
ctx.putImageData(new ImageData(pixels,result.width,result.height),0,0);$('textureStatus').textContent='PNG-filen er klar.';$('textureMeta').textContent=`${result.width} × ${result.height} · ${result.format} · ${result.mipmaps} mipmaps`;const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Safari kunne ikke oprette PNG-filen.')),'image/png'));textureUrl=URL.createObjectURL(blob);const a=$('textureDownload');a.href=textureUrl;a.download=file.name.replace(/\.(paa|edds)$/i,'')+'.png';a.classList.remove('hidden')}catch(e){canvas.width=0;canvas.height=0;$('textureStatus').textContent=e.message||String(e)}}
$('paaInput').addEventListener('change',()=>convertTexture($('paaInput').files[0],'paa'));
$('eddsInput').addEventListener('change',()=>convertTexture($('eddsInput').files[0],'edds'));
window.addEventListener('pagehide',()=>{revoke('pbo');revoke('texture');revoke('paaBuild');revoke('eddsBuild')});
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});


function isPowerOfTwo(n){return n>0&&(n&(n-1))===0}
function le16(n){const a=new Uint8Array(2);new DataView(a.buffer).setUint16(0,n,true);return a}
function le32(n){const a=new Uint8Array(4);new DataView(a.buffer).setUint32(0,n>>>0,true);return a}
function leI32(n){const a=new Uint8Array(4);new DataView(a.buffer).setInt32(0,n,true);return a}
function le24(n){if(n<0||n>0xFFFFFF)throw new Error('Et mipmap er for stort til PAA-formatets 24-bit størrelse.');return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255])}
function ascii(s){return new TextEncoder().encode(s)}
function paaTag(name,payload){return join(ascii('GGAT'),ascii(name.split('').reverse().join('')),leI32(payload.length),payload)}
function colorUint(r,g,b,a){return ((a<<24)|(r<<16)|(g<<8)|b)>>>0}

async function imageFileToCanvas(file){
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();
    img.decoding='async';
    img.src=url;
    await img.decode();
    const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
    const x=c.getContext('2d',{willReadFrequently:true});x.clearRect(0,0,c.width,c.height);x.drawImage(img,0,0);
    return c;
  }finally{URL.revokeObjectURL(url)}
}
function nextMipmapCanvas(source,w,h){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
  x.clearRect(0,0,w,h);x.drawImage(source,0,0,w,h);return c;
}
async function buildPaaFromPng(file,progress){
  const base=await imageFileToCanvas(file),w0=base.width,h0=base.height;
  if(!isPowerOfTwo(w0)||!isPowerOfTwo(h0))throw new Error(`PNG skal have mål i 2-potenser. Denne er ${w0} × ${h0}.`);
  if(w0<4||h0<4)throw new Error('PNG skal være mindst 4 × 4 pixels.');
  if(w0>4096||h0>4096)throw new Error('v0.3 understøtter højst 4096 × 4096 pixels på iPhone.');
  const mipmaps=[];let canvas=base,w=w0,h=h0;let hasAlpha=false;
  let sumR=0,sumG=0,sumB=0,sumA=0,maxR=0,maxG=0,maxB=0,maxA=0,count=0;
  while(w>=4&&h>=4&&mipmaps.length<16){
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),rgba=ctx.getImageData(0,0,w,h).data,bgra=new Uint8Array(rgba.length);
    for(let i=0;i<rgba.length;i+=4){
      const r=rgba[i],g=rgba[i+1],b=rgba[i+2],a=rgba[i+3];
      bgra[i]=b;bgra[i+1]=g;bgra[i+2]=r;bgra[i+3]=a;
      if(mipmaps.length===0){sumR+=r;sumG+=g;sumB+=b;sumA+=a;maxR=Math.max(maxR,r);maxG=Math.max(maxG,g);maxB=Math.max(maxB,b);maxA=Math.max(maxA,a);count++;if(a<255)hasAlpha=true}
    }
    mipmaps.push({w,h,data:bgra});
    progress(mipmaps.length,w,h);
    if(w===4||h===4)break;
    w=Math.max(4,w>>1);h=Math.max(4,h>>1);canvas=nextMipmapCanvas(canvas,w,h);
    await new Promise(r=>setTimeout(r,0));
  }
  const avg=le32(colorUint(Math.round(sumR/count),Math.round(sumG/count),Math.round(sumB/count),Math.round(sumA/count)));
  const max=le32(colorUint(maxR,maxG,maxB,maxA));
  const flag=leI32(hasAlpha?3:0);
  const dummyOffsets=new Uint8Array(64);
  const tagsBeforeOffsets=[paaTag('AVGC',avg),paaTag('MAXC',max),paaTag('FLAG',flag)];
  const headerSize=2+tagsBeforeOffsets.reduce((n,a)=>n+a.length,0)+paaTag('OFFS',dummyOffsets).length+2;
  const offsets=new Uint32Array(16);let pos=headerSize;
  for(let i=0;i<mipmaps.length;i++){offsets[i]=pos;pos+=2+2+3+mipmaps[i].data.length}
  const offPayload=new Uint8Array(64),offView=new DataView(offPayload.buffer);for(let i=0;i<16;i++)offView.setUint32(i*4,offsets[i],true);
  const parts=[le16(0x8888),...tagsBeforeOffsets,paaTag('OFFS',offPayload),le16(0)];
  for(const m of mipmaps)parts.push(le16(m.w),le16(m.h),le24(m.data.length),m.data);
  parts.push(le16(0));
  return{blob:new Blob(parts,{type:'application/octet-stream'}),width:w0,height:h0,mipmaps:mipmaps.length,hasAlpha,size:parts.reduce((n,a)=>n+a.length,0)};
}

$('pngInput').addEventListener('change',async()=>{
  const file=$('pngInput').files[0];if(!file)return;revoke('paaBuild');
  $('paaBuildWork').classList.remove('hidden');$('paaBuildDownload').classList.add('hidden');$('paaBuildName').textContent=file.name;
  $('paaBuildStatus').textContent='Læser PNG…';$('paaBuildBar').style.width='5%';$('paaBuildMeta').textContent='';
  try{
    const result=await buildPaaFromPng(file,(level,w,h)=>{$('paaBuildBar').style.width=`${Math.min(88,12+level*9)}%`;$('paaBuildStatus').textContent=`Genererer mipmap ${level}: ${w} × ${h}…`});
    paaBuildUrl=URL.createObjectURL(result.blob);const a=$('paaBuildDownload');a.href=paaBuildUrl;a.download=file.name.replace(/\.png$/i,'')+'.paa';a.classList.remove('hidden');
    $('paaBuildBar').style.width='100%';$('paaBuildStatus').textContent='PAA-filen er klar til DayZ-test.';
    $('paaBuildMeta').textContent=`${result.width} × ${result.height} · RGBA_8888 · ${result.mipmaps} mipmaps · ${result.hasAlpha?'alpha':'ingen alpha'} · ${(result.size/1024/1024).toFixed(2)} MB`;
  }catch(e){$('paaBuildBar').style.width='0%';$('paaBuildStatus').textContent=e.message||String(e)}
});


function writeAscii(view,offset,text){
  for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));
}
function makeDdsBgra8Header(width,height,mipCount){
  const out=new Uint8Array(128),v=new DataView(out.buffer);
  writeAscii(v,0,'DDS ');
  v.setUint32(4,124,true);
  const DDSD_CAPS=0x1,DDSD_HEIGHT=0x2,DDSD_WIDTH=0x4,DDSD_PITCH=0x8,
        DDSD_PIXELFORMAT=0x1000,DDSD_MIPMAPCOUNT=0x20000;
  v.setUint32(8,DDSD_CAPS|DDSD_HEIGHT|DDSD_WIDTH|DDSD_PITCH|DDSD_PIXELFORMAT|DDSD_MIPMAPCOUNT,true);
  v.setUint32(12,height,true);
  v.setUint32(16,width,true);
  v.setUint32(20,width*4,true);
  v.setUint32(24,0,true);
  v.setUint32(28,mipCount,true);

  // DDS_PIXELFORMAT at byte 76.
  v.setUint32(76,32,true);
  v.setUint32(80,0x41,true); // DDPF_RGB | DDPF_ALPHAPIXELS
  v.setUint32(84,0,true);
  v.setUint32(88,32,true);
  v.setUint32(92,0x00FF0000,true); // R
  v.setUint32(96,0x0000FF00,true); // G
  v.setUint32(100,0x000000FF,true); // B
  v.setUint32(104,0xFF000000,true); // A

  const DDSCAPS_COMPLEX=0x8,DDSCAPS_TEXTURE=0x1000,DDSCAPS_MIPMAP=0x400000;
  v.setUint32(108,DDSCAPS_TEXTURE|DDSCAPS_COMPLEX|DDSCAPS_MIPMAP,true);
  return out;
}
async function buildEddsFromPng(file,progress){
  const base=await imageFileToCanvas(file),width0=base.width,height0=base.height;
  if(width0<1||height0<1)throw new Error('PNG har ugyldige dimensioner.');
  if(width0>4096||height0>4096)throw new Error('v0.4 understøtter højst 4096 × 4096 pixels på iPhone.');

  // Generate level 0 to smallest.
  const levels=[];
  let canvas=base,w=width0,h=height0,hasAlpha=false;
  while(true){
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const rgba=ctx.getImageData(0,0,w,h).data;
    const bgra=new Uint8Array(rgba.length);
    for(let i=0;i<rgba.length;i+=4){
      bgra[i]=rgba[i+2];
      bgra[i+1]=rgba[i+1];
      bgra[i+2]=rgba[i];
      bgra[i+3]=rgba[i+3];
      if(rgba[i+3]<255)hasAlpha=true;
    }
    levels.push({width:w,height:h,data:bgra});
    progress(levels.length,w,h);
    if(w===1&&h===1)break;
    w=Math.max(1,w>>1);h=Math.max(1,h>>1);
    canvas=nextMipmapCanvas(canvas,w,h);
    await new Promise(r=>setTimeout(r,0));
  }

  const header=makeDdsBgra8Header(width0,height0,levels.length);

  // EDDS block table and data are stored smallest mip first.
  const reversed=[...levels].reverse();
  const table=[];
  const payload=[];
  for(const level of reversed){
    table.push(ascii('COPY'),leI32(level.data.length));
    payload.push(level.data);
  }
  const bytes=join(header,...table,...payload);
  const blob=new Blob([bytes],{type:'application/octet-stream'});

  // Self-validation through the existing EDDS decoder.
  const decoded=DTMTextureDecoder.decodeEdds(await blob.arrayBuffer());
  if(decoded.width!==width0||decoded.height!==height0)
    throw new Error(`EDDS-validering fejlede: forventede ${width0} × ${height0}, fik ${decoded.width} × ${decoded.height}.`);

  const original=levels[0].data;
  const decodedRgba=decoded.rgba;
  if(decodedRgba.length!==original.length)
    throw new Error('EDDS-validering fejlede: forkert pixelmængde.');

  // Compare decoded RGBA against original BGRA converted back to RGBA.
  let mismatches=0;
  for(let i=0;i<decodedRgba.length;i+=4){
    if(decodedRgba[i]!==original[i+2]||
       decodedRgba[i+1]!==original[i+1]||
       decodedRgba[i+2]!==original[i]||
       decodedRgba[i+3]!==original[i+3]){
      mismatches++;
      if(mismatches>8)break;
    }
  }
  if(mismatches)throw new Error('EDDS-validering fejlede: pixeldata matcher ikke PNG-kilden.');

  return{
    blob,width:width0,height:height0,mipmaps:levels.length,
    hasAlpha,size:bytes.length,format:'BGRA8 / COPY'
  };
}

$('pngEddsInput').addEventListener('change',async()=>{
  const file=$('pngEddsInput').files[0];if(!file)return;
  revoke('eddsBuild');
  $('eddsBuildWork').classList.remove('hidden');
  $('eddsBuildDownload').classList.add('hidden');
  $('eddsBuildName').textContent=file.name;
  $('eddsBuildStatus').textContent='Læser PNG…';
  $('eddsBuildBar').style.width='5%';
  $('eddsBuildMeta').textContent='';
  try{
    const result=await buildEddsFromPng(file,(level,w,h)=>{
      $('eddsBuildBar').style.width=`${Math.min(84,10+level*6)}%`;
      $('eddsBuildStatus').textContent=`Genererer mipmap ${level}: ${w} × ${h}…`;
    });
    $('eddsBuildStatus').textContent='Validering bestået. EDDS-filen er klar.';
    $('eddsBuildBar').style.width='100%';
    $('eddsBuildMeta').textContent=
      `${result.width} × ${result.height} · ${result.format} · ${result.mipmaps} mipmaps · `+
      `${result.hasAlpha?'alpha':'ingen alpha'} · ${(result.size/1024/1024).toFixed(2)} MB`;
    eddsBuildUrl=URL.createObjectURL(result.blob);
    const a=$('eddsBuildDownload');
    a.href=eddsBuildUrl;
    a.download=file.name.replace(/\.png$/i,'')+'.edds';
    a.classList.remove('hidden');
  }catch(e){
    $('eddsBuildBar').style.width='0%';
    $('eddsBuildStatus').textContent=e.message||String(e);
  }
});
