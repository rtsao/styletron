/**
 * The core styletron module
 * @packagename styletron-core
 */
class StyletronCore {
  /**
   * Create a new StyletronCore instance
   * @param {object} [opts]           An object containing options
   * @param {string} [opts.prefix=''] A prefix for generated CSS class names
   */
  constructor({prefix = ''} = {}) {
    this.cache = {
      media: {},
      pseudo: {},
      keyframes: {},
    };
    this.prefix = prefix === '' ? false : prefix;
    this.uniqueCount = 0;
    this.offset = 10; // skip 0-9
    this.msb = 35;
    this.power = 1;
  }

  static assignDecl(target, decl, className) {
    const {prop, val, media, pseudo} = decl;
    let targetEntry;
    if (media) {
      if (!target.media[media]) {
        target.media[media] = {pseudo: {}};
      }
      targetEntry = target.media[media];
    } else {
      targetEntry = target;
    }
    if (pseudo) {
      if (!targetEntry.pseudo[pseudo]) {
        targetEntry.pseudo[pseudo] = {};
      }
      targetEntry = targetEntry.pseudo[pseudo];
    }
    if (!targetEntry[prop]) {
      targetEntry[prop] = {};
    }
    if (['animationName', 'animation-name'].indexOf(prop) >= 0) {
      const stringVal = JSON.stringify(val);
      let animationName = className;
      if (target.keyframes.hasOwnProperty(stringVal)) {
        animationName = target.keyframes[stringVal];
      } else {
        target.keyframes[stringVal] = animationName;
      }
      targetEntry[prop][animationName] = className;
      return;
    }
    targetEntry[prop][val] = className;
  }

  /**
   * Injects a declaration (if not already injected) and returns a class name
   * @param  {object} decl          The CSS declaration object
   * @param  {string} decl.prop     The property name
   * @param  {string} decl.val      The property value
   * @param  {string} [decl.media]  The media query
   * @param  {string} [decl.pseudo] The pseudo selector
   * @return {string|undefined}     The class name for the declaration
   */
  injectDeclaration(decl) {
    const cached = this.getCachedDeclaration(decl);
    if (cached) {
      return cached;
    }
    const virtualCount = this.incrementVirtualCount();
    const hash = virtualCount.toString(36);
    const className = this.prefix ? this.prefix + hash : hash;
    StyletronCore.assignDecl(this.cache, decl, className);
    return className;
  }

  /**
   * Get the next virtual class number, while setting
   * the uniqueCount, offset, and msb counters appropriately.
   * @return {number} The virtual class count
   * @private
   */
  incrementVirtualCount() {
    const virtualCount = this.uniqueCount + this.offset;
    if (virtualCount === this.msb) {
      this.offset += (this.msb + 1) * 9;
      this.msb = Math.pow(36, ++this.power) - 1;
    }
    this.uniqueCount++;
    return virtualCount;
  }

  /**
   * Gets the class name for an already injected declaration
   * @param  {object} decl          The CSS declaration object
   * @param  {string} decl.prop     The property name
   * @param  {string} decl.val      The property value
   * @param  {string} [decl.media]  The media query
   * @param  {string} [decl.pseudo] The pseudo selector
   * @return {string|undefined}     The class name for the declaration
   * @private
   */
  getCachedDeclaration({prop, val, media, pseudo}) {
    let entry;
    if (media) {
      entry = this.cache.media[media];
      if (!entry) {
        return false;
      }
    } else {
      entry = this.cache;
    }
    if (pseudo) {
      entry = entry.pseudo[pseudo];
      if (!entry) {
        return false;
      }
    }
    if (['animationName', 'animation-name'].indexOf(prop) >= 0) {
      const stringValue = JSON.stringify(val);
      val =
        this.cache.keyframes &&
        this.cache.keyframes.hasOwnProperty(stringValue) &&
        this.cache.keyframes[stringValue];
    }
    return entry[prop] && entry[prop].hasOwnProperty(val) && entry[prop][val];
  }
}

export default StyletronCore;
