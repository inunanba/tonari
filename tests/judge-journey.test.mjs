import test from 'node:test';
import assert from 'node:assert/strict';
import {freshJourney,validateJourney,advanceJourney,journeyComplete,judgeSteps} from '../packages/games/judge-journey.mjs';
test('judge route reaches exactly 24 tiles only through six verified ordered experiences',()=>{let state=freshJourney();assert.equal(state.tiles,18);for(const step of judgeSteps)state=advanceJourney(state,step,true);assert.equal(state.tiles,24);assert.equal(journeyComplete(state),true);});
test('judge progress rejects skips, unverified awards, rollback and unknown fields',()=>{const start=freshJourney();assert.throws(()=>advanceJourney(start,'queue',true),/BAD_JUDGE_JOURNEY/);assert.throws(()=>advanceJourney(start,'swap',false),/BAD_JUDGE_JOURNEY/);assert.throws(()=>validateJourney({version:1,completed:['swap'],tiles:18}),/BAD_JUDGE_JOURNEY/);assert.throws(()=>validateJourney({...start,extra:true}),/BAD_JUDGE_JOURNEY/);});
