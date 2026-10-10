import { describe, expect, it } from 'vitest';
import { parseRoute, regionHref, regionStorageKey } from '../src/router';

describe('hash routing', () => {
  it('opens the introduction at the root and resolves the separate browser and guide', () => {
    for (const hash of ['', '#/', '#']) expect(parseRoute(hash, ['lower-leg'])).toEqual({ kind: 'landing' });
    expect(parseRoute('#/browser', ['lower-leg'])).toEqual({ kind: 'hub' });
    expect(parseRoute('#/browser/', ['lower-leg'])).toEqual({ kind: 'hub' });
    expect(parseRoute('#/how-it-works', ['lower-leg'])).toEqual({ kind: 'how-it-works' });
  });
  it('falls back to the browser for unknown or malformed region links', () => {
    for (const hash of ['#/unknown', '#/%E0%A4%A']) expect(parseRoute(hash, ['lower-leg'])).toEqual({ kind: 'hub' });
  });
  it('resolves the shared credits page', () => {
    expect(parseRoute('#/credits', ['lower-leg'])).toEqual({ kind: 'credits' });
  });
  it('preserves existing region and structure deep links', () => {
    expect(parseRoute('#/lower-leg?select=talus', ['lower-leg'])).toEqual({kind:'region',regionId:'lower-leg',select:'talus'});
    expect(parseRoute(regionHref('second region', 'a/b & c'), ['second region'])).toEqual({kind:'region',regionId:'second region',select:'a/b & c'});
    expect(parseRoute('#/lower-leg/', ['lower-leg'])).toEqual({kind:'region',regionId:'lower-leg',select:null});
  });
  it('namespaces regional settings without collisions', () => {
    expect(regionStorageKey('lower-leg','selection')).not.toBe(regionStorageKey('upper-arm','selection'));
  });
});
