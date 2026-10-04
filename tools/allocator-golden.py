"""Execute the exact canonical AST allocation statements; do not rewrite the Python rule.
Usage: python tools/allocator-golden.py research/tonari_sim.py
Scope: deterministic allocation kernel ONLY, not full crowd/offer/governor simulation.
"""
import ast,hashlib,json,math,random,sys
from pathlib import Path
import numpy as np
source=Path(sys.argv[1]).read_bytes();tree=ast.parse(source)
block=next(n for n in ast.walk(tree) if isinstance(n,ast.If) and isinstance(n.test,ast.Name) and n.test.id=='damped' and n.lineno==332)
code=compile(ast.fix_missing_locations(ast.Module(body=block.body[:15],type_ignores=[])),'canonical-tonari-allocation-AST','exec')
def state():return dict(weights=[0.0]*8,gate=[0.0]*8,levels=[0]*8,zones=[0]*4,previous=None)
def run(s,i):
 e=dict(np=np,math=math,W_MAX=8.0,GAMMA=2.0,DT=.5,SLOPE_COOL=.3,COOL_FACTOR=.25,TAU_UP=6.0,TAU_DOWN=.5,P_MAX=.5,SPOT_CAP_SHARE=.25,CAP=np.array([12,10,10,8,8,6,6,6],float),ZONE=np.array([0,0,1,1,2,2,3,3]),NZ=4,strategy='damped',display_moves=0,
  meas=np.array(i['waits'],float),prev_meas=None if s['previous'] is None else np.array(s['previous'],float),w_s=np.array(s['weights'],float),w_gate=np.array(s['gate'],float),level=np.array(s['levels'],int),zlevel=np.array(s['zones'],int),window_boundary=i['boundary'],nudge_eff=i['nudge'],win_budget=i['budget'],win_given=i['given'],win_spot_given=np.array(i['spotGiven'],float))
 exec(code,e)
 return dict(state=dict(weights=e['w_s'].tolist(),gate=e['w_gate'].tolist(),levels=e['level'].tolist(),zones=e['zlevel'].tolist(),previous=e['prev_meas'].tolist()),chances=e['p_drop'].tolist(),suggestions=None if e['sugg_q'] is None else e['sugg_q'].tolist(),capLeft=e['cap_left'].tolist())
rng=random.Random(20261004);s=state();vectors=[]
for j in range(128):
 i=dict(waits=[0.0]*8 if j<12 else [rng.uniform(0,12) for _ in range(8)],boundary=j%12==0,nudge=[0,1,2,4,8][j%5],budget=[0,30,60,75.5][j%4],given=[0,3,60][j%3],spotGiven=[rng.randrange(0,20) for _ in range(8)])
 expected=run(s,i);vectors.append(dict(input=i,before=s,expected=expected));s=expected['state']
out=dict(scope='exact deterministic allocation AST statements0..14; NOT full simulator',source_sha256=hashlib.sha256(source).hexdigest(),source_lines=[333,358],vectors=vectors)
Path('tests/allocator-golden.json').write_text(json.dumps(out,indent=2)+'\n');print('128 canonical Python allocation vectors generated')
