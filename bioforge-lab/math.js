'use strict';
// Deterministic math (pure): sine, cosine and arc tangent built from + - * / only, so they give the same bits in every
// browser and in Node. Math.sin, Math.cos and Math.atan2 may differ between JavaScript engines in the last bit, and
// one bit is enough for two runs of the same design to drift apart. The polynomials are those of fdlibm, the C math
// library most engines started from, so results stay within about one unit in the last place of the exact value.

const HALF_PI = Math.PI / 2;
const TWO_OVER_PI = 2 / Math.PI;
const HALF_PI_HIGH = 1.57079632673412561417e+00;          // the first 33 bits of π/2: quadrant * this is exact
const HALF_PI_LOW = 6.07710050650619224932e-11;           // π/2 - HALF_PI_HIGH
const PI_LOW = 1.2246467991473531772e-16;                 // π - Math.PI

// sine and cosine on [-π/4, π/4] (fdlibm __kernel_sin and __kernel_cos)
const SINE_TERMS = [
  -1.66666666666666324348e-01, 8.33333333332248946124e-03, -1.98412698298579493134e-04,
  2.75573137070700676789e-06, -2.50507602534068634195e-08, 1.58969099521155010221e-10,
];
const COSINE_TERMS = [
  4.16666666666666019037e-02, -1.38888888888741095749e-03, 2.48015872894767294178e-05,
  -2.75573143513906633035e-07, 2.08757232129817482790e-09, -1.13596475577881948265e-11,
];

// arc tangent (fdlibm atan): the input is moved next to one of four reference points with a known arc tangent
const ARC_TANGENT_HIGH = [
  4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00,
];
const ARC_TANGENT_LOW = [
  2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17,
];
const ARC_TANGENT_TERMS = [
  3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01,
  9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02,
  4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02,
];
const ARC_TANGENT_HUGE = 7.3786976294838206464e19;        // 2^66: above this the arc tangent is π/2
const ARC_TANGENT_TINY = 1 / 536870912;                  // 2^-29: below this the arc tangent is the input itself

function sineNearZero(angle) {
  const squared = angle * angle;
  const tail = SINE_TERMS[1] + squared * (SINE_TERMS[2] + squared * (SINE_TERMS[3] + squared *
    (SINE_TERMS[4] + squared * SINE_TERMS[5])));
  return angle + squared * angle * (SINE_TERMS[0] + squared * tail);
}

function cosineNearZero(angle) {
  const squared = angle * angle;
  const tail = squared * (COSINE_TERMS[0] + squared * (COSINE_TERMS[1] + squared * (COSINE_TERMS[2] + squared *
    (COSINE_TERMS[3] + squared * (COSINE_TERMS[4] + squared * COSINE_TERMS[5])))));
  const halfSquared = 0.5 * squared;
  const rounded = 1 - halfSquared;
  return rounded + (((1 - rounded) - halfSquared) + squared * tail);
}

// the nearest multiple of π/2 to the angle, counted in quarter turns
function quarterTurnsIn(angle) {
  return Math.round(angle * TWO_OVER_PI);
}

// what is left of the angle after taking away whole quarter turns, in [-π/4, π/4]
function angleAfterQuarterTurns(angle, quarterTurns) {
  return (angle - quarterTurns * HALF_PI_HIGH) - quarterTurns * HALF_PI_LOW;
}

// which quarter of the circle (0..3) a count of quarter turns ends in
function quadrantOf(quarterTurns) {
  return (quarterTurns % 4 + 4) % 4;
}

// sin(angle), deterministic. Accurate for |angle| up to about a million radians.
function sine(angle) {
  if (angle === 0) return angle;                          // keeps the sign of -0, like Math.sin
  const quarterTurns = quarterTurnsIn(angle);
  const rest = angleAfterQuarterTurns(angle, quarterTurns);
  switch (quadrantOf(quarterTurns)) {
    case 0: return sineNearZero(rest);
    case 1: return cosineNearZero(rest);
    case 2: return -sineNearZero(rest);
    default: return -cosineNearZero(rest);
  }
}

// cos(angle), deterministic
function cosine(angle) {
  const quarterTurns = quarterTurnsIn(angle);
  const rest = angleAfterQuarterTurns(angle, quarterTurns);
  switch (quadrantOf(quarterTurns)) {
    case 0: return cosineNearZero(rest);
    case 1: return -sineNearZero(rest);
    case 2: return -cosineNearZero(rest);
    default: return sineNearZero(rest);
  }
}

// atan(value), deterministic
function arcTangent(value) {
  const negative = value < 0;
  let ratio = Math.abs(value);
  if (!(ratio < ARC_TANGENT_HUGE)) return ratio !== ratio ? value : negative ? -HALF_PI : HALF_PI;
  if (ratio < ARC_TANGENT_TINY) return value;
  let reference = -1;                                     // index into ARC_TANGENT_HIGH, or -1 for "near zero"
  if (ratio >= 0.4375) {
    if (ratio < 0.6875) {
      reference = 0;
      ratio = (2 * ratio - 1) / (2 + ratio);
    } else if (ratio < 1.1875) {
      reference = 1;
      ratio = (ratio - 1) / (ratio + 1);
    } else if (ratio < 2.4375) {
      reference = 2;
      ratio = (ratio - 1.5) / (1 + 1.5 * ratio);
    } else {
      reference = 3;
      ratio = -1 / ratio;
    }
  }
  const squared = ratio * ratio;
  const fourth = squared * squared;
  const terms = ARC_TANGENT_TERMS;
  const oddTerms = squared * (terms[0] + fourth * (terms[2] + fourth * (terms[4] + fourth * (terms[6] + fourth *
    (terms[8] + fourth * terms[10])))));
  const evenTerms = fourth * (terms[1] + fourth * (terms[3] + fourth * (terms[5] + fourth * (terms[7] + fourth *
    terms[9]))));
  const result = reference < 0
    ? ratio - ratio * (oddTerms + evenTerms)
    : ARC_TANGENT_HIGH[reference] - ((ratio * (oddTerms + evenTerms) - ARC_TANGENT_LOW[reference]) - ratio);
  return negative ? -result : result;
}

// atan2(y, x), deterministic: the angle of the point (x, y), in [-π, π]
function arcTangent2(y, x) {
  if (x !== x || y !== y) return NaN;
  const xNegative = x < 0 || Object.is(x, -0);
  const yNegative = y < 0 || Object.is(y, -0);
  const halfTurn = yNegative ? -Math.PI : Math.PI;
  if (y === 0) return xNegative ? halfTurn : y;
  if (x === 0) return yNegative ? -HALF_PI : HALF_PI;
  if (!isFinite(x)) {
    if (!isFinite(y)) return (xNegative ? 3 : 1) * (yNegative ? -Math.PI : Math.PI) / 4;
    return xNegative ? halfTurn : (yNegative ? -0 : 0);
  }
  if (!isFinite(y)) return yNegative ? -HALF_PI : HALF_PI;
  const angle = arcTangent(Math.abs(y / x));
  if (!xNegative) return yNegative ? -angle : angle;
  return yNegative ? (angle - PI_LOW) - Math.PI : Math.PI - (angle - PI_LOW);
}

// a small, fast seeded random generator (mulberry32) that uses only 32-bit integer math, so every engine gives the
// same sequence. Takes the generator's state and returns [next state, a number in [0, 1)].
function nextRandom(state) {
  const nextState = (state + 0x6d2b79f5) | 0;
  let mixed = Math.imul(nextState ^ (nextState >>> 15), nextState | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return [nextState, ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296];
}
