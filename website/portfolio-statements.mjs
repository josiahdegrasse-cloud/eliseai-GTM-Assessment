// Preserve adjacent number/label statistic blocks as exact normalized source text.
// Never combine non-adjacent counters or infer that a development total is managed.
export function portfolioStatStatements(text){
 const lines=String(text||'').split(/\n/).map(s=>s.replace(/^\s*#{1,6}\s*/,'').trim()).filter(Boolean),out=[];
 const number=/^(?:(?:over|more than|approximately|about|nearly|at least)\s+)?\d[\d,.]*\+?(?:\s+(?:million|thousand))?$/i;
 const label=/^(?:(?:residential|rental|multifamily|apartment)\s+)?(?:residences|apartments|apartment homes|homes and apartments|homes|units|properties|communities)\s+(?:managed|under management|owned|operated|developed(?:,? acquired)?(?: and built)?|built)$/i;
 const inline=new RegExp('^'+number.source.slice(1,-1)+'\\s+'+label.source.slice(1,-1)+'$','i');
 for(const line of lines)if(inline.test(line))out.push(line);
 for(let i=0;i<lines.length-1;i++){
  if(/\b(?:customers?|clients?)\b/i.test(lines.slice(Math.max(0,i-2),i).join(' ')))continue;
  if(number.test(lines[i])&&label.test(lines[i+1]))out.push(lines[i]+' '+lines[i+1]);
  if(label.test(lines[i])&&number.test(lines[i+1])&&!number.test(lines[i-1]||''))out.push(lines[i]+' '+lines[i+1]);
 }
 return out;
}
