import {test} from 'node:test';
import assert from 'node:assert/strict';
import {structuredProfiles} from '../website/structured-profiles.mjs';
test('reads explicit public Next page person fields without running JavaScript',()=>{
 const html='<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{leaders:[{name:'Jordan Lee',position:'Chief Operating Officer'},{name:'Alex Smith',position:'Chief Financial Officer'}]}}})+'</script><script>throw Error("never execute")</script>';
 assert.deepEqual(structuredProfiles(html).profiles,[{name:'Jordan Lee',role:'Chief Operating Officer'},{name:'Alex Smith',role:'Chief Financial Officer'}]);
});
test('separate unrelated name and title records cannot be paired',()=>{
 const html='<script type="application/json">[{"name":"Jordan Lee"},{"position":"Chief Operating Officer"}]</script>';
 assert.deepEqual(structuredProfiles(html).profiles,[]);
});
test('malformed and executable scripts never become profiles',()=>{
 assert.deepEqual(structuredProfiles('<script>var x={name:"Jordan Lee",position:"CEO"}</script><script type="application/json">oops</script>').profiles,[]);
});
