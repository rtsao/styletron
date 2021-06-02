// @flow
import {Readable, Transform} from "stream";

import SequentialIDGenerator from "../sequential-id-generator.js";

import type {StandardEngine} from "styletron-standard";

import {Cache, MultiCache} from "../cache.js";

import injectStylePrefixed from "../inject-style-prefixed.js";

import type {
  StyleObject,
  FontFaceObject,
  KeyframesObject,
} from "styletron-standard";

import {
  styleBlockToRule,
  atomicSelector,
  keyframesBlockToRule,
  declarationsToBlock,
  keyframesToBlock,
  fontFaceBlockToRule,
} from "../css.js";

export type attrsT = {
  "data-hydrate"?: "keyframes" | "font-face",
  media?: string,
  class?: string,
};

export type sheetT = {|
  insertBeforeMedia?: string,
  css: string,
  attrs: attrsT,
|};

type optionsT = {
  prefix?: string,
  streamingMode?: boolean,
  scriptGenerator?: (sheet: sheetT, className: string, attrs: attrsT) => string,
};

class StyletronServer implements StandardEngine {
  styleCache: MultiCache<{pseudo: string, block: string}>;
  keyframesCache: Cache<KeyframesObject>;
  fontFaceCache: Cache<FontFaceObject>;
  styleRules: {
    [string]: {
      insertBeforeMedia?: string,
      rules: string,
    },
  };
  keyframesRules: string;
  fontFaceRules: string;
  streamingMode: boolean;
  scriptGenerator: (sheet: sheetT, className: string, attrs: attrsT) => string;

  constructor(opts?: optionsT = {}) {
    this.streamingMode = opts.streamingMode || false;
    this.scriptGenerator = opts.scriptGenerator || generateScript;
    this.styleRules = {"": {rules: ""}};
    this.styleCache = new MultiCache(
      new SequentialIDGenerator(opts.prefix),
      (media, _cache, insertBeforeMedia) => {
        this.styleRules[media] = {
          insertBeforeMedia,
          rules: "",
        };
      },
      (cache, id, value) => {
        const {pseudo, block} = value;
        this.styleRules[cache.key].rules += styleBlockToRule(
          atomicSelector(id, pseudo),
          block,
        );
      },
    );

    this.fontFaceRules = "";
    this.fontFaceCache = new Cache(
      new SequentialIDGenerator(opts.prefix),
      (cache, id, value) => {
        this.fontFaceRules += fontFaceBlockToRule(
          id,
          declarationsToBlock(value),
        );
      },
    );

    this.keyframesRules = "";
    this.keyframesCache = new Cache(
      new SequentialIDGenerator(opts.prefix),
      (cache, id, value) => {
        this.keyframesRules += keyframesBlockToRule(
          id,
          keyframesToBlock(value),
        );
      },
    );
  }

  renderStyle(style: StyleObject): string {
    return injectStylePrefixed(this.styleCache, style, "", "");
  }

  renderFontFace(fontFace: FontFaceObject): string {
    const key = JSON.stringify(fontFace);
    return this.fontFaceCache.addValue(key, fontFace);
  }

  renderKeyframes(keyframes: KeyframesObject): string {
    const key = JSON.stringify(keyframes);
    return this.keyframesCache.addValue(key, keyframes);
  }

  getStylesheets(): Array<sheetT> {
    const sheets = [
      ...(this.keyframesRules.length
        ? [
            {
              css: this.keyframesRules,
              attrs: {"data-hydrate": "keyframes"},
            },
          ]
        : []),
      ...(this.fontFaceRules.length
        ? [
            {
              css: this.fontFaceRules,
              attrs: {"data-hydrate": "font-face"},
            },
          ]
        : []),
      ...sheetify(
        this.styleRules,
        this.styleCache.getSortedCacheKeys(),
        this.streamingMode,
      ),
    ];

    // Clear streamed styles
    if (this.streamingMode) {
      this.keyframesRules = "";
      this.fontFaceRules = "";
      for (const prop in this.styleRules) {
        this.styleRules[prop].rules = "";
      }
    }

    return sheets;
  }

  getStylesheetsHtml(className?: string = "_styletron_hydrate_") {
    return generateHtmlString(
      this.getStylesheets(),
      className,
      this.streamingMode,
      this.scriptGenerator,
    );
  }

  // Copied and adapted from: https://github.com/styled-components/styled-components/blob/28b4c28f1e/packages/styled-components/src/models/ServerStyleSheet.js#L78
  getStylesheetsStream(htmlStream: Readable) {
    if (!this.streamingMode)
      throw new Error(
        "getStylesheetsStream() requires streamingMode to be set to true for Styletron server",
      );

    const readableStream: Readable = htmlStream;
    const CLOSING_TAG_R = /^\s*<\/[a-z]/i;

    const instance = this;

    const transformer = new Transform({
      transform: function appendStyleChunks(chunk, /* encoding */ _, callback) {
        // Get the chunk and retrieve the sheet's CSS as an HTML chunk,
        // then reset its rules so we get only new ones for the next chunk
        const htmlChunk = chunk.toString();
        const cssScriptChunk = instance.getStylesheetsHtml();

        // prepend style html to chunk, unless the start of the chunk is a
        // closing tag in which case append right after that
        if (CLOSING_TAG_R.test(htmlChunk)) {
          const endOfClosingTag = htmlChunk.indexOf(">") + 1;
          const before = htmlChunk.slice(0, endOfClosingTag);
          const after = htmlChunk.slice(endOfClosingTag);

          this.push(before + cssScriptChunk + after);
        } else {
          this.push(cssScriptChunk + htmlChunk);
        }

        callback();
      },
    });

    readableStream.on("error", err => {
      // forward the error to the transform stream
      transformer.emit("error", err);
    });

    return readableStream.pipe(transformer);
  }

  getCss() {
    return (
      this.keyframesRules +
      this.fontFaceRules +
      stringify(this.styleRules, this.styleCache.getSortedCacheKeys())
    );
  }
}

export function generateHtmlString(
  sheets: Array<sheetT>,
  className: string,
  streamingMode: boolean = false,
  scriptGenerator: Function,
) {
  let html = "";
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const {class: originalClassName, ...rest} = sheet.attrs;
    const attrs = {
      class: originalClassName
        ? `${className} ${originalClassName}`
        : className,
      ...(rest: attrsT),
    };

    if (!streamingMode) {
      html += `<style${attrsToString(attrs)}>${sheet.css}</style>`;
    } else {
      html += scriptGenerator(sheet, className, attrs);
    }
  }

  return html;
}

function attrsToString(attrs: attrsT) {
  let result = "";
  for (const attr in attrs) {
    const value = attrs[attr];
    if (value === true) {
      result += " " + attr;
    } else if (value !== false) {
      result += ` ${attr}="${value}"`;
    }
  }
  return result;
}

function stringify(styleRules, sortedCacheKeys) {
  let result = "";
  sortedCacheKeys.forEach(cacheKey => {
    const rules = styleRules[cacheKey].rules;
    if (cacheKey !== "") {
      result += `@media ${cacheKey}{${rules}}`;
    } else {
      result += rules;
    }
  });
  return result;
}

function sheetify(styleRules, sortedCacheKeys, streamingMode): Array<sheetT> {
  if (sortedCacheKeys.length === 0) {
    return [{css: "", attrs: {}}];
  }
  const sheets = [];
  sortedCacheKeys.forEach(cacheKey => {
    // omit media (cacheKey) attribute if empty
    const attrs = cacheKey === "" ? {} : {media: cacheKey};
    let insertBeforeMedia;
    if (streamingMode)
      insertBeforeMedia = styleRules[cacheKey].insertBeforeMedia;
    sheets.push({
      insertBeforeMedia,
      css: styleRules[cacheKey].rules,
      attrs,
    });
  });
  return sheets;
}

function generateScript(sheet: sheetT, className: string, attrs: attrsT) {
  if (!sheet.css.length) return "";

  const content = [];
  content.push(`
  <script>
  (function () {
  `);

  const selector = attrs.media
    ? `style.${className}[media='${attrs.media}']`
    : `style.${className}:not([media])`;

  content.push(`
    var styleElement = document.head.querySelector("${selector}");
    if (!styleElement) {
      styleElement = document.createElement("style");`);

  for (const attr in attrs) {
    content.push(`
      styleElement.setAttribute("${attr}", "${attrs[attr]}");`);
  }

  if (sheet.insertBeforeMedia) {
    content.push(`
      var predecessor = document.querySelector('[media="${sheet.insertBeforeMedia}"]');
      document.head.insertBefore(styleElement, predecessor);`);
  } else {
    content.push(`
      document.head.append(styleElement);`);
  }

  content.push(`
    }
    styleElement.innerHTML = styleElement.innerHTML + " ${sheet.css}";
    document.currentScript.remove();
  }());
  </script>
  `);

  return content.join("");
}

export default StyletronServer;
