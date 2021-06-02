// @flow

import Styletron from "../server";

const stylesFixtures = [
  {color: "red"},
  {color: "green"},
  {"@media (min-width: 800px)": {color: "green"}},
  // should be added before "min-width: 800px" query
  // test that Styletron properly sort media queries
  {"@media (min-width: 600px)": {color: "red"}},
  {"@media (min-width: 800px)": {":hover": {color: "green"}}},
  {zIndex: void 0}, // Should be silently ignored
  // null values were historically supported (albeit erronesouly)
  {opacity: null}, // Should be silently ignored
  {":hover": {display: "none"}},
  {userSelect: "none"},
  {display: "flex"},
];

const keyframesFixtures = {
  from: {
    color: "purple",
  },
  "50%": {
    color: "yellow",
  },
  to: {
    color: "orange",
  },
};

const fontFaceFixtures = {
  src: "local('Roboto')",
};

export function injectFixtureStyles(styletron: Styletron) {
  stylesFixtures.forEach(style => styletron.renderStyle(style));
}

export function injectFixtureKeyframes(styletron: Styletron) {
  return styletron.renderKeyframes(keyframesFixtures);
}

export function injectFixtureFontFace(styletron: Styletron) {
  return styletron.renderFontFace(fontFaceFixtures);
}
