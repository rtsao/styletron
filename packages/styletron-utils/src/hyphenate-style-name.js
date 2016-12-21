const uppercasePattern = /[A-Z]/g;
const msPattern = /^ms-/;

module.exports = hyphenateStyleName;

function hyphenateStyleName(prop) {
  return prop
    .replace('cssFloat', 'float')
    .replace(uppercasePattern, '-$&')
    .toLowerCase()
    .replace(msPattern, '-ms-');
}
