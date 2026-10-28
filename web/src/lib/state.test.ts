import { beforeEach, describe, expect, it } from 'vitest';
import { LAST_DECADE } from './types';
import { goBack, openSimilar, selectCounty, ui } from './state.svelte';

describe('"← Back to breakdown" (spec 6.6)', () => {
  beforeEach(() => {
    Object.assign(ui, { mode: 'change', decade: LAST_DECADE, pinned: null, highlight: null, selected: -1, trail: [] });
  });

  it('is offered only when a breakdown pathway was pinned or pointed at', () => {
    selectCounty(5);
    expect(ui.fromBreakdown).toBe(false);
    ui.pinned = 3;
    selectCounty(6);
    expect(ui.fromBreakdown).toBe(true);
    ui.pinned = null;
    ui.highlight = 2;
    selectCounty(7);
    expect(ui.fromBreakdown).toBe(true);
  });

  it('needs the breakdown on screen: Decadal population change at 2010–20', () => {
    ui.pinned = 3;
    ui.decade = 2;
    selectCounty(5);
    expect(ui.fromBreakdown).toBe(false);
    ui.decade = LAST_DECADE;
    ui.mode = 'context';
    selectCounty(6);
    expect(ui.fromBreakdown).toBe(false);
  });

  it('survives following similar counties and their back link; closing clears it', () => {
    ui.pinned = 3;
    selectCounty(5);
    ui.pinned = null;
    openSimilar(9);
    expect(ui.fromBreakdown).toBe(true);
    goBack();
    expect(ui.selected).toBe(5);
    expect(ui.fromBreakdown).toBe(true);
    selectCounty(-1);
    expect(ui.fromBreakdown).toBe(false);
  });
});
