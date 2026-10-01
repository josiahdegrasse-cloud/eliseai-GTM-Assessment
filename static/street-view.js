// Accept only Google-generated Street View embed URLs, never arbitrary iframe HTML.
export const propertyViewKey=lead=>JSON.stringify(['property_address','city','state','postal_code','country'].map(k=>String(lead[k]||'').trim().toLowerCase()));
export function googleStreetViewEmbed(value){
 const text=String(value||'').trim();if(!text||text.length>4096)return '';
 const src=text.startsWith('<iframe')?text.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]:text;
 try{const url=new URL(String(src||'').replaceAll('&amp;','&'));
 if(url.origin!=='https://www.google.com'||url.username||url.password||url.pathname!=='/maps/embed'||!url.searchParams.get('pb')?.includes('!6m8!1m7!1s'))return '';
 return 'https://www.google.com/maps/embed?'+new URLSearchParams({pb:url.searchParams.get('pb')});
 }catch{return ''}
}
export function savedStreetView(lead){return lead.property_address&&lead.street_view?.address_key===propertyViewKey(lead)?googleStreetViewEmbed(lead.street_view.url):''}
