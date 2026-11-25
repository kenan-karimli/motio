import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storyHTML, storyParts, THEMES, STORY_KINDS } from '../src/stories.js';

const route = { color: '#6E8CF7', points: [[40.409, 49.867], [40.405, 49.872], [40.399, 49.884]] };
const D = {
  today: { kicker: 'Fri', lead: 'Today', big: '2h 14m', goal: 'goal', routes: [route], modes: [{ label: 'Walk', pct: 60, color: '#3DBF5C' }], stats: [{ v: '9 km', k: 'distance' }, { v: '9,412', k: 'steps' }] },
  cover: { kicker: 'Week 44', title: 'Your week,\nwrapped', sub: 'Oct', bigLabel: 'covered', big: '412 km', routes: [route] },
  distance: { kicker: 'k', lead: 'You covered', num: '412', unit: 'km', line: 'far', bars: [{ label: 'Drive', value: '214 km', pct: 52, color: '#F6C343' }] },
  time: { kicker: 'k', lead: 'You spent', big: '21h 40m', line: 'l', hourly: Array(24).fill(1), peak: 'Peak 8 AM' },
  highlights: { kicker: 'k', title: 'Highlights', tiles: [{ k: 'NEW PR', v: '18 km', s: 'Thu' }] },
  wrap: { kicker: 'k', lead: 'You were', name: 'The Urban Wanderer', stat: 's', grid: [{ v: '412 km', k: 'covered' }], end: 'bye' },
  persona: { name: 'The Wanderer', month: 'm', tagline: 't', desc: 'd', stat: 's', traits: [{ left: 'a', name: 'Pace', right: 'b', w: '40%' }] },
  challenge: { kicker: 'k', big: '100 km in a week', leadLine: 'Sam leads', racers: [{ name: 'Sam', value: '62 km', f: 0.6, ini: 'S', color: '#F2766B' }] },
  trip: { kicker: 'k', lead: 'Ride', big: '18.4 km', routes: [route], stats: [{ v: '49m', k: 'time' }] }
};

test('every theme draws every kind of card', () => {
  for (const theme of Object.keys(THEMES)) for (const kind of STORY_KINDS) {
    const html = storyHTML(kind, D[kind], { theme, name: 'Alex' });
    assert.match(html, /^<div style="width:360px;height:640px/, `${theme}/${kind}`);
    assert.ok(!html.includes('undefined') && !html.includes('NaN'), `${theme}/${kind} has undefined/NaN`);
  }
});

test('text from screens is escaped', () => {
  assert.ok(!storyHTML('trip', { ...D.trip, lead: '<img src=x onerror=alert(1)>' }, { theme: 'mono' }).includes('<img src=x'));
});

test('hidden stats, chart, map and name stay out of the card', () => {
  const html = storyHTML('today', D.today, { theme: 'editorial', hide: ['steps', 'chart'], showMap: false, showName: false, name: 'Alex' });
  assert.ok(!html.includes('9,412') && html.includes('9 km'));
  assert.ok(!html.includes('<svg width="100%"') && !html.includes('Walk'));
  assert.ok(!html.includes('Alex') && html.includes('motio.'));
  assert.deepEqual(storyParts('today', D.today).map((p) => p.key), ['distance', 'steps', 'chart']);
});

test('the five board styles, and old style names still work', () => {
  assert.deepEqual(Object.keys(THEMES), ['mono', 'glow', 'poster', 'ticket', 'editorial']);
  assert.match(storyHTML('time', D.time, { theme: 'night' }), /radial-gradient\(90% 60%/); // night → glow
  assert.match(storyHTML('time', D.time, { theme: 'poster' }), />21h<br>40m</);
  assert.match(storyHTML('trip', D.trip, { theme: 'mono', h: 360 }), /^<div style="width:360px;height:360px/);
});
