// @flow

/* eslint-env browser */

import StyletronServer from "../../server/server.js";
import StyletronClient from "../client.js";
import test from "tape";
const reduce = Array.prototype.reduce;
const map = Array.prototype.map;

test("container config", t => {
  const instance = new StyletronClient();
  t.strictEqual(
    instance.container,
    document.head,
    "container defaults to document.head",
  );
  t.end();
});

test("automatic stylesheet insertion", t => {
  const container = document.createElement("div");
  document.body && document.body.appendChild(container);
  const instance = new StyletronClient({container});
  t.strictEqual(instance.container, container, "uses container config");
  // lazy instantiation
  t.equal(document.styleSheets.length, 0, "sheet not yet instantiated");
  t.equal(
    instance.renderStyle({color: "purple"}),
    "ae",
    "new unique class returned",
  );
  t.equal(document.styleSheets.length, 1, "sheet added");
  instance.container.remove();
  t.equal(document.styleSheets.length, 0, "no sheets after container removed");
  t.end();
});

test("rendering", t => {
  const container = document.createElement("div");
  document.body && document.body.appendChild(container);
  const instance = new StyletronClient({container});
  t.equal(
    instance.renderStyle({color: "purple"}),
    "ae",
    "new unique class returned",
  );
  t.deepEqual(sheetsToRules(document.styleSheets), [
    {media: "", rules: [".ae { color: purple; }"]},
  ]);
  t.equal(
    instance.renderStyle({
      "@media (min-width: 800px)": {color: "purple"},
    }),
    "af",
    "new unique class returned",
  );
  t.deepEqual(sheetsToRules(document.styleSheets), [
    {media: "", rules: [".ae { color: purple; }"]},
    {media: "(min-width: 800px)", rules: [".af { color: purple; }"]},
  ]);
  instance.renderStyle({
    userSelect: "none",
  });
  t.deepEqual(sheetsToRules(document.styleSheets), [
    {
      media: "",
      rules: [".ae { color: purple; }", ".ag { user-select: none; }"],
    },
    {media: "(min-width: 800px)", rules: [".af { color: purple; }"]},
  ]);
  instance.renderStyle({
    display: "flex",
  });
  t.deepEqual(sheetsToRules(document.styleSheets), [
    {
      media: "",
      rules: [
        ".ae { color: purple; }",
        ".ag { user-select: none; }",
        ".ah { display: flex; }",
      ],
    },
    {media: "(min-width: 800px)", rules: [".af { color: purple; }"]},
  ]);
  instance.renderStyle({
    "@media (min-width: 600px)": {
      color: "red",
    },
  });
  t.deepEqual(
    sheetsToRules(document.styleSheets),
    [
      {
        media: "",
        rules: [
          ".ae { color: purple; }",
          ".ag { user-select: none; }",
          ".ah { display: flex; }",
        ],
      },
      {media: "(min-width: 600px)", rules: [".ai { color: red; }"]},
      {media: "(min-width: 800px)", rules: [".af { color: purple; }"]},
    ],
    "media queries are mobile first sorted",
  );

  instance.renderStyle({
    ":hover": {
      color: "orange",
      ":after": {
        content: '"abc"',
      },
    },
  });
  t.deepEqual(
    sheetsToRules(document.styleSheets),
    [
      {
        media: "",
        rules: [
          ".ae { color: purple; }",
          ".ag { user-select: none; }",
          ".ah { display: flex; }",
          ".aj:hover { color: orange; }",
          '.ak:hover::after { content: "abc"; }',
        ],
      },
      {media: "(min-width: 600px)", rules: [".ai { color: red; }"]},
      {media: "(min-width: 800px)", rules: [".af { color: purple; }"]},
    ],
    "renders nested pseudo-selectors",
  );

  instance.container.remove();
  t.end();
});

test("prefix", t => {
  const container = document.createElement("div");
  document.body && document.body.appendChild(container);
  const instance = new StyletronClient({container, prefix: "foo_"});
  t.equal(
    instance.renderStyle({color: "purple"}),
    "foo_ae",
    "new unique class returned",
  );
  t.equal(
    instance.renderFontFace({src: "url(blah)"}),
    "foo_ae",
    "new unique font family returned",
  );
  t.equal(
    instance.renderKeyframes({from: {color: "red"}, to: {color: "blue"}}),
    "foo_ae",
    "new unique animation name returned",
  );
  t.deepEqual(sheetsToRules(document.styleSheets), [
    {
      media: "",
      rules: [
        ".foo_ae { color: purple; }",
        `@font-face { font-family: foo_ae; src: url("blah"); }`,
        "@keyframes foo_ae { \n  0% { color: red; }\n  100% { color: blue; }\n}",
      ],
    },
  ]);
  instance.container.remove();
  t.end();
});

test("hydration", t => {
  const {getSheets, cleanup, container} = setup();

  // SSR
  const server = new StyletronServer();
  injectFixtureStyles(server);
  container.innerHTML = server.getStylesheetsHtml();

  // Hydration
  const instance = new StyletronClient({
    hydrate: getSheets(),
  });

  const beforeSheetLength = document.styleSheets.length;
  const beforeRules = elementsToRules(getSheets());
  injectFixtureStyles(instance);
  const afterSheetLength = document.styleSheets.length;
  const afterRules = elementsToRules(getSheets());
  t.equal(
    beforeSheetLength,
    afterSheetLength,
    "number of stylesheets should not have changed",
  );
  t.deepEqual(
    afterRules,
    beforeRules,
    "CSSStylesheet rules not changed after rendering hydrated styles",
  );
  cleanup();
  t.end();
});

test("keyframes hydration", t => {
  const {getSheets, cleanup, container} = setup();

  const addKeyframes = styletron => {
    styletron.renderKeyframes({
      from: {transform: "rotate(0deg)"},
      to: {transform: "rotate(360deg)"},
    });
    styletron.renderKeyframes({
      "0%": {transform: "translateX(-100%)"},
      "50%": {transform: "translateX(-100%)"},
      "100%": {transform: "translateX(100%)"},
    });
  };

  // SSR
  const server = new StyletronServer();
  addKeyframes(server);
  container.innerHTML = server.getStylesheetsHtml();

  // Hydration
  const instance = new StyletronClient({
    hydrate: getSheets(),
  });

  const beforeSheetLength = document.styleSheets.length;
  const beforeRules = elementsToRules(getSheets());
  addKeyframes(instance);
  const afterSheetLength = document.styleSheets.length;
  const afterRules = elementsToRules(getSheets());
  t.equal(
    beforeSheetLength,
    afterSheetLength,
    "number of stylesheets should not have changed",
  );
  t.deepEqual(
    afterRules,
    beforeRules,
    "CSSStylesheet rules not changed after rendering hydrated styles",
  );
  cleanup();
  t.end();
});

test("sort client media queries", t => {
  const {cleanup, container} = setup();

  const styletron = new StyletronClient({container});

  styletron.renderStyle({
    "@media (min-width: 700px)": {
      color: "pink",
    },
  });

  t.deepEqual(sheetsToRules(document.styleSheets), [
    {media: "", rules: []},
    {media: "(min-width: 700px)", rules: [".ae { color: pink; }"]},
  ]);

  cleanup();
  t.end();
});

test("sort a new media query after hydration", t => {
  const {getSheets, cleanup, container} = setup();

  // SSR
  const server = new StyletronServer();
  injectFixtureStyles(server);
  container.innerHTML = server.getStylesheetsHtml();

  //Hydration
  const instance = new StyletronClient({
    hydrate: getSheets(),
    container,
  });

  //render a client-only and unique media query (mid position)
  instance.renderStyle({
    "@media (min-width: 700px)": {
      color: "pink",
    },
  });

  //render a client-only and unique media query (end position)
  instance.renderStyle({
    "@media (min-width: 1000px)": {
      color: "black",
    },
  });

  t.deepEqual(sheetsToRules(document.styleSheets), [
    {
      media: "",
      rules: [
        "@keyframes ae { \n  0% { color: red; }\n  100% { color: blue; }\n}",
      ],
    },
    {media: "", rules: ['@font-face { font-family: ae; src: url("blah"); }']},
    {
      media: "",
      rules: [
        ".ae { color: red; }",
        ".af { color: green; }",
        ".aj:hover { display: none; }",
        ".ak { user-select: none; }",
        ".al { display: flex; }",
      ],
    },
    {media: "(min-width: 600px)", rules: [".ah { color: red; }"]},
    {media: "(min-width: 700px)", rules: [".am { color: pink; }"]},
    {
      media: "(min-width: 800px)",
      rules: [".ag { color: green; }", ".ai:hover { color: green; }"],
    },
    {media: "(min-width: 1000px)", rules: [".an { color: black; }"]},
  ]);

  cleanup();
  t.end();
});

function injectFixtureStyles(styletron) {
  styletron.renderStyle({color: "red"});
  styletron.renderStyle({color: "green"});
  styletron.renderStyle({
    "@media (min-width: 800px)": {
      color: "green",
    },
  });
  styletron.renderStyle({
    "@media (min-width: 600px)": {
      color: "red",
    },
  });
  styletron.renderStyle({
    "@media (min-width: 800px)": {
      ":hover": {
        color: "green",
      },
    },
  });
  styletron.renderStyle({
    ":hover": {
      display: "none",
    },
  });
  styletron.renderStyle({
    userSelect: "none",
  });
  styletron.renderStyle({
    display: "flex",
  });
  styletron.renderStyle({
    backgroundImage:
      "url(data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=)",
  });
  styletron.renderFontFace({src: "url(blah)"});
  styletron.renderKeyframes({from: {color: "red"}, to: {color: "blue"}});
}

function setup() {
  const container = document.createElement("div");
  if (document.body === void 0) {
    throw new Error("no body");
  }

  if (document.body === null) {
    throw new Error("body is null");
  }
  document.body.appendChild(container);

  return {
    container,
    getSheets() {
      return ((container.children: any): HTMLCollection<HTMLStyleElement>);
    },
    cleanup() {
      container.remove();
    },
  };
}

function sheetToRules(sheet) {
  return reduce.call(
    sheet.cssRules,
    (acc, rule) => {
      return [...acc, rule.cssText];
    },
    [],
  );
}

function elementsToRules(elements) {
  return sheetsToRules(map.call(elements, el => el.sheet));
}

function sheetsToRules(sheets) {
  return reduce.call(
    sheets,
    (acc, sheet) => {
      return [
        ...acc,
        {media: sheet.media.mediaText, rules: sheetToRules(sheet)},
      ];
    },
    [],
  );
}
