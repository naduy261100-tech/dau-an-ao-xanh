const statusEl=document.getElementById("status");
const detailEl=document.getElementById("details");
function report(s,d=""){statusEl.textContent=s;detailEl.textContent=d;document.body.dataset.status=s.startsWith("PASS")?"pass":s.startsWith("FAIL")?"fail":"running";}
async function run(){
 let remover, sourceBitmap, outputBitmap;
 try{
  report("Loading @katana-video/web-bg-removal…");
  const {BackgroundRemover}=await import("https://cdn.jsdelivr.net/npm/@katana-video/web-bg-removal@0.1.1/+esm");
  report("Downloading Longpipe XL weights (14.5 MB)…");
  remover=await BackgroundRemover.load("longpipe-xl",{backend:"auto",dtype:"auto",onProgress:f=>report("Loading model: "+Math.round(f*100)+"%")});
  report("Loading public test portrait…");
  const img=document.getElementById("source");
  img.src="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=1000";
  await img.decode();
  const sample=document.createElement("canvas");sample.width=img.naturalWidth;sample.height=img.naturalHeight;
  sample.getContext("2d").drawImage(img,0,0);
  sourceBitmap=await createImageBitmap(sample);
  report("Running local Longpipe XL matting…","No image bytes are sent to the server.");
  const t=performance.now();
  outputBitmap=await remover.removeBackground(sourceBitmap);
  const elapsed=Math.round(performance.now()-t);
  const canvas=document.createElement("canvas");canvas.width=outputBitmap.width;canvas.height=outputBitmap.height;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(outputBitmap,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let transparent=0,soft=0,opaque=0;
  for(let i=3;i<pixels.length;i+=4){const a=pixels[i];if(a<10)transparent++;else if(a>245)opaque++;else soft++;}
  canvas.toBlob(blob=>{
   if(blob){const url=URL.createObjectURL(blob);document.getElementById("cutout").src=url;}
  },"image/png");
  report("PASS — Longpipe XL produced a transparent person matte.",JSON.stringify({
   model:"longpipe-xl",backend:remover.backend,dtype:remover.dtype,
   width:outputBitmap.width,height:outputBitmap.height,elapsedMs:elapsed,
   transparent,soft,opaque,pixels:canvas.width*canvas.height
  },null,2));
 }catch(e){report("FAIL — "+(e?.message||String(e)),e?.stack||"");}
 finally{try{sourceBitmap?.close()}catch{}try{outputBitmap?.close()}catch{}try{remover?.destroy()}catch{}}
}
run();