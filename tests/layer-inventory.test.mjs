import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest} from '../packages/protocol/index.mjs';
import {randomUUID} from 'node:crypto';
test('layer inventory requires only a valid composition context',()=>assert.doesNotThrow(()=>validateRequest({version:'0.1',requestId:randomUUID(),app:'after_effects',operation:'composition.getLayers',arguments:{context:randomUUID(),compositionId:1}})));
