(function(root){
  'use strict';
  const imageTypes=['image/jpeg','image/png','image/webp'];
  const documents=['pdf','doc','docx','xls','xlsx','ppt','pptx','odt','ods','txt','csv','rtf'];
  const imageExtensions=/\.(jpe?g|png|webp|heic|heif)$/i;
  const isImage=file=>{
    const mime=file.type||file.mime||'';
    return imageTypes.includes(mime)||['image/heic','image/heif'].includes(mime)||
      ((!mime||mime==='application/octet-stream')&&imageExtensions.test(file.name||''));
  };
  function validate(files,imagesOnly=false,max=8){
    if(!files.length)throw new Error('Vyber alespoň jeden soubor.');
    if(files.length>max)throw new Error('Vyber nejvýš '+max+' souborů najednou.');
    for(const f of files){
      const image=isImage(f),extension=f.name?.split('.').pop().toLowerCase();
      if(!image&&(imagesOnly||!documents.includes(extension)))throw new Error(imagesOnly?'Povolené jsou JPG, PNG a WebP.':'Vyber JPG, PNG, WebP nebo dokument PDF, Office, ODT, ODS, TXT, CSV či RTF. HEIC nejprve převeď do JPG.');
      if(!f.size)throw new Error('Soubor '+f.name+' je prázdný.');
      if(f.size>25*1024*1024)throw new Error('Soubor '+f.name+' je větší než 25 MB.');
    }
  }
  async function prepare(file){
    validate([file]);
    if(!isImage(file))return file;
    const url=URL.createObjectURL(file),image=new Image();
    try{
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Fotku '+file.name+' se nepodařilo přečíst. Zkus ji převést do JPG.'));image.src=url;});
      const width=image.naturalWidth,height=image.naturalHeight;
      if(!width||!height||width*height>100000000)throw new Error('Fotka má neplatné nebo příliš velké rozměry.');
      const scale=Math.min(1,1920/Math.max(width,height)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Prohlížeč nepodporuje zmenšení fotky.');
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.8));
      if(!blob||blob.type!=='image/jpeg')throw new Error('Prohlížeč nedokázal uložit zmenšenou fotku do JPG.');
      // Never inflate a small existing image; retain it unchanged instead.
      if(scale===1&&imageTypes.includes(file.type)&&blob.size>=file.size)return file;
      return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified});
    }finally{URL.revokeObjectURL(url);}
  }
  const api={isImage,validate,prepare};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GarazMedia=api;
})(typeof window!=='undefined'?window:globalThis);
