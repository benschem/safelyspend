import { describe, it, expect } from 'vitest';
import { currentVersion } from '@/lib/changelog';
import packageJson from '../../../package.json';

describe('currentVersion', () => {
  it('matches the version in package.json, since both are bumped by hand', () => {
    expect(currentVersion).toBe(packageJson.version);
  });
});
