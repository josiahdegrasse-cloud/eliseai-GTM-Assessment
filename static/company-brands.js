// Verified company marks shipped with the assessment. No network lookup needed.
const brands=[
 {domain:'herzogapartments.com',name:/^herzog(?: property management)?$/i,file:'herzog',theme:'dark'},
 {domain:'trimarkpm.com',name:/^trimark(?: property management| corporation)?$/i,file:'trimark'},
 {domain:'cpmanagement.com',name:/^cp\s?management$/i,file:'cpmanagement'},
 {domain:'aamci.com',name:/^aamci$/i,file:'aamci'},
 {domain:'greystar.com',name:/^greystar(?: real estate partners)?(?: llc)?$/i,file:'greystar'},
 {domain:'camdenliving.com',name:/^camden(?: property trust)?$/i,file:'camden'},
 {domain:'amli.com',name:/^amli(?: residential)?$/i,file:'amli'},
 {domain:'redpeak.com',name:/^redpeak(?: properties)?$/i,file:'redpeak'},
 {domain:'atlanticresi.com',name:/^atlantic residential$/i,file:'atlantic',theme:'dark'},
 {domain:'bozzuto.com',name:/^bozzuto(?: management company)?$/i,file:'bozzuto'},
 {domain:'yardi.com',name:/^yardi(?: systems)?$/i,file:'yardi'},
 {domain:'appfolio.com',name:/^appfolio(?: inc\.?)?$/i,file:'appfolio'},
 {domain:'marcusmillichap.com',name:/^marcus\s*(?:&|and)\s*millichap$/i,file:'marcus',theme:'dark'},
];
export function knownCompanyLogo(company,website,email=''){
 try{
  const value=website||email.split('@').at(-1),url=new URL(value.includes('://')?value:'https://'+value);
  if(url.protocol!=='https:'||url.port||url.username||url.password)return null;
  const domain=url.hostname.toLowerCase().replace(/^www\./,''),brand=brands.find(b=>b.domain===domain&&b.name.test(String(company).trim()));
  return brand?{status:'found',image:'/company-marks/'+brand.file+'-v2.png',page_url:'https://www.'+domain+'/',kind:'logo',theme:brand.theme||'light'}:null;
 }catch{return null}
}
