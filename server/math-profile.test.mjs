import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMathProfile, runWithMathProfile, PROFILES } from './math-profile.mjs';

describe('math profile override', () => {
  it('uses voice_social when scoped', () => {
    runWithMathProfile('voice_social', () => {
      const p = getMathProfile();
      assert.equal(p.plantedWinRate, PROFILES.voice_social.plantedWinRate);
    });
  });

  it('restores previous profile after scope', () => {
    const before = getMathProfile().plantedWinRate;
    runWithMathProfile('stingy', () => {
      assert.equal(getMathProfile().plantedWinRate, PROFILES.stingy.plantedWinRate);
    });
    assert.equal(getMathProfile().plantedWinRate, before);
  });
});
