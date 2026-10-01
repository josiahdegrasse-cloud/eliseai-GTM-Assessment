const ENDPOINT='https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage';
export function aerialRequest(context){
 const {x,y}=context?.coordinates||{};
 if(context?.status!=='matched'||!Number.isFinite(x)||!Number.isFinite(y)||x<-125||x>-66||y<24||y>50)return null;
 // A 600 × 350 metre neighborhood around the approximate Census point.
 const centerX=x*20037508.34/180,centerY=Math.log(Math.tan((90+y)*Math.PI/360))*20037508.34/Math.PI,scale=1/Math.cos(y*Math.PI/180);
 const bbox=[centerX-300*scale,centerY-175*scale,centerX+300*scale,centerY+175*scale].map(n=>n.toFixed(2)).join(',');
 return {url:ENDPOINT+'?'+new URLSearchParams({bbox,bboxSR:'3857',imageSR:'3857',size:'720,420',format:'jpg',compressionQuality:'85',f:'image'}),options:{method:'GET',redirect:'manual',headers:{Accept:'image/jpeg'},signal:AbortSignal.timeout(10000)}};
}
export async function aerialImage(response){
 if(!response.ok||!/^image\/jpeg(?:;|$)/i.test(response.headers.get('Content-Type')||''))throw Error('No aerial image');
 const reader=response.body?.getReader();if(!reader)throw Error('Empty image');
 const chunks=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>300000){await reader.cancel();throw Error('Image too large')}chunks.push(value)}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length}
 if(size<32||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('Invalid JPEG');
 let dimensions=false,end=-1;
 for(let i=2;i+8<size;){
  if(bytes[i]!==255)break;const marker=bytes[i+1],length=bytes[i+2]*256+bytes[i+3];if(length<2||i+2+length>size)break;
  if([192,193,194].includes(marker)){const height=bytes[i+5]*256+bytes[i+6],width=bytes[i+7]*256+bytes[i+8];dimensions=width>0&&height>0&&width<=720&&height<=420;break}
  i+=2+length;
 }
 for(let i=size-2;i>2;i--)if(bytes[i]===255&&bytes[i+1]===217){end=i+2;break}
 if(!dimensions||end<0)throw Error('Invalid JPEG dimensions');
 // The public service can append padding/metadata after JPEG's end marker.
 let binary='';for(const byte of bytes.subarray(0,end))binary+=String.fromCharCode(byte);
 return 'data:image/jpeg;base64,'+btoa(binary);
}
