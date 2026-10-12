import {savedStreetView} from './street-view.js';
import {states} from './map-data.js';
export function accountInitials(company=''){
 const words=String(company).trim().match(/[\p{L}\p{N}]+/gu)||[];
 return words.slice(0,2).map(w=>[...w][0]).join('').toUpperCase()||'?';
}
export function locationPoint(context={}){
 const {x,y}=context.coordinates||{};
 return context.status==='matched'&&typeof x==='number'&&typeof y==='number'&&Number.isFinite(x)&&Number.isFinite(y)&&y>=17&&y<=72&&((x>=-180&&x<=-60)||(x>=170&&x<=180))?{x,y}:null;
}
// The pulled address is authoritative; geocoder normalization may drop units or
// return a different street number. Keep display and Google queries identical.
export function propertyAddress(lead){
 if(!String(lead.property_address||'').trim())return '';
 return [lead.property_address,lead.city,lead.state,lead.postal_code,lead.country].map(v=>String(v??'').trim()).filter(Boolean).join(', ');
}
function streetAddressCore(value){
 // Compare the street itself, not just the house number. Census can normalize
 // suffixes and append locality fields, so compare the first address segment.
 return String(value||'').trim().split(',')[0]
  .replace(/\b(?:apartment|apt|suite|ste|unit)\s*[#-]?\s*[^,]+$/i,'')
  .replace(/#\s*[A-Za-z0-9-]+$/,'')
  .toLowerCase().replace(/[.,]/g,' ').replace(/\s+/g,' ').trim()
  .replace(/\b(street|st)\b/g,'st').replace(/\b(avenue|ave)\b/g,'ave')
  .replace(/\b(road|rd)\b/g,'rd').replace(/\b(boulevard|blvd)\b/g,'blvd')
  .replace(/\b(drive|dr)\b/g,'dr').replace(/\b(lane|ln)\b/g,'ln')
  .replace(/\b(court|ct)\b/g,'ct').replace(/\b(highway|hwy)\b/g,'hwy');
}
export function propertyViewLinks(lead){
 const address=propertyAddress(lead);if(!address)return {};
 const p=lead.property_context||{},point=locationPoint(p);
 const submittedStreet=streetAddressCore(lead.property_address),matchedStreet=streetAddressCore(p.address);
 const consistent=!p.address||(!!submittedStreet&&!!matchedStreet&&submittedStreet===matchedStreet);
 return {...(point&&!p.stale&&consistent?{street:'https://www.google.com/maps/@?'+new URLSearchParams({api:'1',map_action:'pano',viewpoint:point.y+','+point.x})}:{}),search:'https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:address})};
}
export function streetViewMarkup(lead,{esc}){
 const address=propertyAddress(lead);if(!address)return '';
 const saved=savedStreetView(lead),links=propertyViewLinks(lead);
 // Keep Google's hosted, keyless panorama inside its iframe. A fresh Census
 // match locates the street, not proof of the building or ownership.
 const point=links.street?locationPoint(lead.property_context):null;
 // Only embed a panorama explicitly saved for this exact submitted address.
 // Coordinates locate a street; they do not prove an exact building/panorama match.
 const url=saved&&(!lead.property_context?.address||links.street)?saved:'';
 if(!url)return `<p class="claim-caption">Street View is not available yet for this address.</p>`;
 return `<figure class="street-view street-view-preview"><iframe src="${esc(url)}" title="${esc('Google Street View near '+address)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="fullscreen" allowfullscreen></iframe></figure>`;
}

export function propertyImageryMarkup(lead,ui){
 const point=locationPoint(lead.property_context),links=propertyViewLinks(lead),supported=point&&point.x>=-125&&point.x<=-66&&point.y>=24&&point.y<=50;
 const buttons=Object.entries(links).map(([key,url])=>`<a href="${ui.esc(url)}" target="_blank" rel="noopener noreferrer">${key==='satellite'?'Google satellite':key==='street'?'Street View':'Find address on Google Maps'}</a>`).join('');
 return `<div class="property-visual">${supported?`<figure class="aerial-view" id="property-aerial" data-lead="${ui.esc(lead.id)}"><div class="aerial-frame"><div class="aerial-placeholder"><span>Aerial view</span><p class="aerial-status" role="status">Loading the address area…</p></div></div><figcaption><span>USGS / USDA NAIP</span><span>Capture date varies · Not live</span></figcaption></figure>`:locationMapMarkup(lead,ui)}${buttons?`<div class="property-view-links">${buttons}</div>`:''}</div>`;
}
export function locationMapMarkup(lead,{esc}){
 const p=lead.property_context||{},point=locationPoint(p);
 if(!point)return `<div class="map-unavailable"><svg viewBox="0 0 96 64" aria-hidden="true"><path d="m9 17 25-9 28 9 25-9v40l-25 9-28-9-25 9Zm25-9v40m28-31v40"/><circle cx="49" cy="29" r="7"/><path d="m49 36 0 9"/></svg><span>${p.status==='unsupported'?'Map outside current coverage':'Location not established'}</span><p>A map appears when Census returns a usable address match.</p></div>`;
 const width=560,height=240,span=point.y>50?32:point.y<25?8:16,cos=Math.cos(point.y*Math.PI/180),scale=width/(span*cos);
 const project=([x,y])=>[width/2+(x-point.x)*cos*scale,height/2-(y-point.y)*scale];
 const latSpan=height/scale;
 const visible=states.filter(s=>s.bounds[2]>=point.x-span/2&&s.bounds[0]<=point.x+span/2&&s.bounds[3]>=point.y-latSpan/2&&s.bounds[1]<=point.y+latSpan/2);
 const paths=visible.map(s=>`<path d="${s.rings.map(r=>r.map((p,i)=>{const [x,y]=project(p);return (i?'L':'M')+x.toFixed(1)+','+y.toFixed(1)}).join('')+'Z').join('')}"><title>${esc(s.name)}</title></path>`).join('');
 const labels=visible.map(s=>{const [x,y]=project(s.center);return x>45&&x<width-45&&y>25&&y<height-25&&Math.hypot(x-width/2,y-height/2)>55?`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(s.name)}</text>`:''}).join('');
 return `<figure class="location-map"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Approximate Census address location near ${esc([lead.city,lead.state].filter(Boolean).join(', '))}"><rect width="560" height="240" class="map-water"/><g class="map-outlines">${paths}</g><g class="map-labels">${labels}</g><g class="map-north" transform="translate(533 20)"><path d="M0 21V0m-4 6 4-6 4 6"/><text y="34">N</text></g><circle cx="280" cy="120" r="22" class="map-halo"/><circle cx="280" cy="120" r="7" class="map-pin"/><circle cx="280" cy="120" r="2" class="map-dot"/></svg><figcaption><span class="map-legend"><i></i>${p.stale||p.sample_snapshot?'Saved':'Approximate'} address location</span><span>U.S. Census · Regional view</span></figcaption></figure>`;
}
