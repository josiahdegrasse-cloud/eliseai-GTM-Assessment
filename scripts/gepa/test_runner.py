import csv, json, subprocess, sys, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from run import validate_policy, freeze_splits, DEFAULT, NoRedirect, local_reflection, load_reviews
class RunnerTests(unittest.TestCase):
    def test_rejects_unbounded_candidate(self):
        for value in [None,[],{'ask_style':'inject','subject_style':'original'},{**DEFAULT,'code':'execute'}]:
            with self.assertRaises(ValueError): validate_policy(value)
    def test_split_leakage_rejected(self):
        with self.assertRaises(ValueError): freeze_splits([{'id':'A'},{'id':'B'}],{'train':['A'],'validation':['A']})
        self.assertEqual(freeze_splits([{'id':'A'},{'id':'B'}],{'train':['A'],'validation':['B']}),([{'id':'A'}],[{'id':'B'}]))
    def test_network_blocked_even_with_ambient_keys(self):
        code="from run import offline_network; import socket; offline_network(); socket.create_connection(('127.0.0.1',11434))"
        result=subprocess.run([sys.executable,'-c',code],cwd=Path(__file__).parent,text=True,capture_output=True)
        self.assertNotEqual(result.returncode,0);self.assertIn('network access is disabled',result.stderr)
    def test_ratings_require_exact_drafts_and_complete_labels(self):
        original={'id':'G01','draft_id':'revision1','subject':'Subject','email':'Exact wording'}
        fields=['case_id','draft_id','subject','email','reviewer','would_send','reason']
        row={'case_id':'G01','draft_id':'revision1','subject':'Subject','email':'Exact wording','reviewer':'TEST reviewer','would_send':'Would send','reason':'TEST ONLY'}
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'review.csv'
            def write(value):
                with path.open('w',newline='') as f:
                    w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerow(value)
            write(row);self.assertEqual(load_reviews(path,[original])[('G01','revision1')]['score'],1)
            for changed in [{'would_send':''},{'draft_id':'obsolete'},{'email':'Different text'},{'reviewer':''}]:
                write({**row,**changed})
                with self.assertRaises(ValueError):load_reviews(path,[original])
    def test_local_reflection_transport_and_schema(self):
        class Response:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,n):return json.dumps({'message':{'content':json.dumps({'ask_style':'overview','subject_style':'original'})}}).encode()
        with patch('run.build_opener') as build:
            build.return_value.open.return_value=Response()
            value=local_reflection('already-installed',{'email_policy':json.dumps(DEFAULT)},{'email_policy':[]})
            self.assertEqual(value['ask_style'],'overview')
            request=build.return_value.open.call_args.args[0]
            self.assertEqual(request.full_url,'http://127.0.0.1:11434/api/chat')
        with self.assertRaises(RuntimeError):NoRedirect().redirect_request()
if __name__=='__main__':unittest.main()
