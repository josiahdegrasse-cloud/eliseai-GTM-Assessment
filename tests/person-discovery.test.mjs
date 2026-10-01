import {test} from 'node:test';
import assert from 'node:assert/strict';
import {personLinks,sitemapLinks,personPublicationDate} from '../website/person-discovery.mjs';
const lead={name:'Jordan Lee',website:'acmehousing.com'},url='https://acmehousing.com/';
test('duplicate unlabeled URLs preserve the strongest observed team-link label',()=>{
 const target=url+'our-company/ourteam/';
 const links=personLinks(lead,{url,links:[{url:target,text:'Our Team'},{url:url+'news/',text:'News'}],text:'[Company page]('+target+')'});
 assert.deepEqual(links[0],{url:target,score:70});
});
test('announcement dates require metadata or a standalone publication-date line',()=>{
 assert.equal(personPublicationDate({url:url+'news/leadership',content:'News\n3/27/2026\nLeadership changes'}),'2026-03-27T00:00:00.000Z');
 assert.equal(personPublicationDate({url:url+'news/leadership',content:'Navigation '.repeat(1800)+'\n3/27/2026\nLeadership changes'}),'2026-03-27T00:00:00.000Z');
 assert.equal(personPublicationDate({url:url+'news/leadership',content:'The event is on 3/27/2026.'}),null);
 assert.equal(personPublicationDate({url:url+'team',content:'3/27/2026'}),null);
 assert.equal(personPublicationDate({url,publishedDate:'not a date'}),null);
});
test('public tenant-resource directories remain discovery candidates',()=>{
 assert.equal(personLinks(lead,{url,links:[{url:url+'tenant-resources/',text:'Tenant resources'}]})[0].score,55);
});
test('person link labels find biographies whose URLs contain no name',()=>{
 const links=personLinks(lead,{url,links:[{url:url+'about',text:'About us'},{url:url+'profile?id=1',text:'Jordan Lee'},{url:url+'bio/481',text:'Jordan Lee'},{url:url+'people',text:'Leadership'},{url:'https://evil.com/jordan-lee',text:'Jordan Lee'}]});
 assert.deepEqual(links.map(l=>l.url),[url+'profile?id=1',url+'bio/481',url+'people',url+'about']);
});
test('relative Markdown links and name paths outrank generic team navigation',()=>{
 const links=personLinks(lead,{url,text:'[About](about) [Our team](/leadership) [Read more](/people/jordan-lee) [Login](/login)'});
 assert.equal(links[0].url,url+'people/jordan-lee');assert.equal(links.length,3);
});
test('sitemaps expose only safe same-company URLs; summaries cannot become evidence',()=>{
 const xml='<urlset><url><loc>https://acmehousing.com/bio/jordan-lee</loc></url><url><loc>https://evil.com/</loc></url><url><loc>http://acmehousing.com/team</loc></url><url><loc>https://user:pass@acmehousing.com/team</loc></url></urlset>';
 assert.deepEqual(sitemapLinks(xml,url,'acmehousing.com'),[{url:url+'bio/jordan-lee',text:''}]);
 assert.deepEqual(sitemapLinks('<html>Jordan Lee CEO</html>',url,'acmehousing.com'),[]);
});
test('malformed percent encodings and unsafe assets cannot interrupt link discovery',()=>{
 assert.deepEqual(personLinks(lead,{url,links:[{url:url+'people/%ZZ',text:'Jordan Lee'},{url:url+'team.png',text:'Team'}]}),[]);
});
test('business and investor branches outrank unrelated team blog posts and careers',()=>{
 const links=personLinks(lead,{url,links:[{url:url+'blog/team-building',text:'Team building'},{url:'https://careers.acmehousing.com/',text:'Our team'},{url:url+'storybook/leadership',text:'Leadership'},{url:url+'business',text:'Business services'},{url:'https://investors.acmehousing.com/',text:'Investors'},{url:url+'our-team',text:'Our team'}]});
 assert.deepEqual(links.map(x=>x.url),[url+'our-team','https://investors.acmehousing.com/','https://careers.acmehousing.com/',url+'business']);
});
test('career culture pages are allowed while job openings and portals stay excluded',()=>{
 const links=personLinks(lead,{url,links:[{url:'https://careers.acmehousing.com/us/en/inclusion',text:'Inclusion'},{url:'https://careers.acmehousing.com/us/en/job/123',text:'Jordan Lee manager'},{url:'https://jobs.acmehousing.com/',text:'Leadership'}]});
 assert.deepEqual(links.map(l=>l.url),['https://careers.acmehousing.com/us/en/inclusion']);
});
