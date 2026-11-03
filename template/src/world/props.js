// src/world/props.js - the props the film uses, defined once.
//
// A prop definition is a builder plus its construction constants. Because every shot draws the piano through this one
// entry, the piano cannot lose a leg, change its lid angle or move between shots.
'use strict';

function defineProps() {
  defineThing('prop', 'piano', {
    kind: 'grand piano',
    build: (place, o) => buildPiano(place, o),
    keyPoint: (u) => pianoKeyPoint(PIANO_PLACE(), u),
    caseHeight: 0.94,
    lidAngle: 34,
  });
  defineThing('prop', 'house', {
    kind: 'house (ruined)',
    build: (place, o) => buildHouse(place, { width: 8.6, depth: 6.4, height: 3.5, ridge: 2.0, doorX: 3.85, ...o }),
    eaveHeight: 3.94,
  });
  defineThing('prop', 'tree', {
    kind: 'bare tree',
    // branch geometry generated once at define time: the tree is the same tree in every shot
    branches: treeBranches(7, { levels: 3, trunkH: 2.35, trunkR: 0.20, lean: 0.05 }),
    build: (place, o) => buildTree(place, { branches: getThing('prop', 'tree').branches, leafClumps: 16, ...o }),
  });
  defineThing('prop', 'stones', {
    kind: 'field stones',
    build: (place, o) => buildStones(place, o),
  });
  defineThing('prop', 'tufts', {
    kind: 'grass tufts',
    build: (place, o) => buildTufts(place, { count: FIELD.tufts.count, spreadX: FIELD.tufts.spreadX, spreadZ: FIELD.tufts.spreadZ, ...o }),
  });
  defineThing('prop', 'candle', {
    kind: 'candle (practical light)',
    build: (place, o) => buildCandle(place, o),
  });
  // The bird is an engine module rather than a static prop, but it is registered so that only one exists and so that
  // its perch point is documented in the same place as everything else.
  defineThing('prop', 'bird', {
    kind: 'bird',
    draw: (state, o) => drawBird(state, o),
    perch: () => FIELD.birdPerch.slice(),
    wingspan: BIRD.wingInner * 2 + BIRD.wingOuter * 2,
  });
}
