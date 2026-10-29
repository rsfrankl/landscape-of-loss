import { beforeEach, describe, expect, it } from 'vitest';
import { LAST_DECADE } from './types';
import { focus, goBack, mapView, openSimilar, profileOpen, selectCounty, setSimilarOpen, similarView, ui } from './state.svelte';

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

describe('similar counties block (spec 6.5, 6.7)', () => {
  beforeEach(() => {
    Object.assign(ui, { selected: -1, trail: [] });
    selectCounty(-1);
  });

  it('starts collapsed for each newly selected county; following matches and back keeps it open', () => {
    selectCounty(5);
    setSimilarOpen(true);
    openSimilar(9);
    expect(profileOpen.similar).toBe(true);
    goBack();
    expect(profileOpen.similar).toBe(true);
    selectCounty(7);
    expect(profileOpen.similar).toBe(false);
  });

  it('hiding returns the map to the view from before the block opened, once', () => {
    selectCounty(5);
    setSimilarOpen(true);
    similarView.before ??= { ...mapView.current, k: 2.5 };
    openSimilar(9);
    goBack();
    const seq = focus.seq;
    setSimilarOpen(false);
    expect(focus.seq).toBe(seq + 1);
    expect(focus.view).toEqual({ x: 0, y: 0, k: 2.5 });
    expect(similarView.before).toBeNull();
    setSimilarOpen(false);
    expect(focus.seq).toBe(seq + 1);
  });

  it('a new selection forgets the saved view, so it never moves the map', () => {
    selectCounty(5);
    setSimilarOpen(true);
    similarView.before = { k: 2, x: 1, y: 1 };
    const seq = focus.seq;
    selectCounty(6);
    expect(similarView.before).toBeNull();
    setSimilarOpen(false);
    expect(focus.seq).toBe(seq);
  });
});
