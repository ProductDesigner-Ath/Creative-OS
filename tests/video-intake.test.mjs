import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeFilename} from '../services/video-intake/server.mjs';

test('video intake accepts supported local video filenames',()=>{
  assert.equal(sanitizeFilename('Reference 01.mp4'),'Reference 01.mp4');
  assert.equal(sanitizeFilename('clip.MOV'),'clip.MOV');
});
test('video intake rejects executable and traversal upload names',()=>{
  assert.throws(()=>sanitizeFilename('../unsafe.exe'),{code:'BAD_FILENAME'});
  assert.throws(()=>sanitizeFilename(''),{code:'BAD_FILENAME'});
});
