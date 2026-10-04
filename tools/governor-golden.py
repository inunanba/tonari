"""Execute actual window-recovery, early multiplier and warning AST blocks.
This is deterministic policy parity, not the stochastic crowd simulator.
"""
import ast, hashlib, json, sys
from pathlib import Path
import numpy as np
source=Path(sys.argv[1]).read_bytes(); tree=ast.parse(source)
nodes=list(ast.walk(tree))
def compiled(body):return compile(ast.fix_missing_locations(ast.Module(body=body,type_ignores=[])), 'canonical-governor-AST','exec')
boost=next(n for n in nodes if isinstance(n,ast.FunctionDef) and n.name=='bmult')
recovery=next(n for n in nodes if isinstance(n,ast.If) and n.lineno==295)
warning=next(n for n in nodes if isinstance(n,ast.If) and n.lineno==388)
budget=next(n for n in nodes if isinstance(n,ast.If) and n.lineno==299)
vectors=[]
for target in [0,.5,1,2,4,8]:
 s=dict(effective=target,hot=False,lastCut=-1e9,windowBudget=30*target*1.5*.6)
 for time in [0,.5,1.5,2,2.5,6,12,90,100]:
  boundary=time in [6,12,90,100]; waits=[0]*8; counts=[0]*8
  if time<6:waits[4]=7;counts[4]=8
  i=dict(time=time,target=target,waits=waits,induced10=counts,boundary=boundary,windowMinutes=6,early=True)
  e=dict(np=np,EARLY_BUDGET_BOOST=.5,early=1,nudge=target,nudge_eff=s['effective'],win_hot=s['hot'],last_cut=s['lastCut'],governor=True,damped=True,BUDGET=30,t=time,win_len=6,budget=s['windowBudget']/ .6,GOV_WARN=.75,W_MAX=8,ind_heavy=np.array(counts)>=np.array([12,10,10,8,8,6,6,6]),meas=np.array(waits))
  exec(compiled([boost]),e)
  if boundary:exec(compiled([recovery,budget]),e)
  effective=e['nudge_eff']; before=dict(s);exec(compiled([warning]),e)
  s=dict(effective=e['nudge_eff'],hot=e['win_hot'],lastCut=e['last_cut'],windowBudget=e['budget']*.6 if boundary else s['windowBudget'])
  result=dict(state=s,effectiveForFrame=effective,warning=bool(np.any(e['ind_heavy'] & (e['meas']>6))),cut=s['lastCut']!=before['lastCut'])
  vectors.append(dict(before=before,input=i,expected=result))
Path('tests/governor-golden.json').write_text(json.dumps(dict(source_sha256=hashlib.sha256(source).hexdigest(),scope='exact deterministic Python AST window recovery/early budget/post-allocation warning; not full simulator',vectors=vectors),indent=2)+'\n')
print(f'{len(vectors)} canonical governor vectors generated')
