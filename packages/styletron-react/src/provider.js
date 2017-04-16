const React = require('react');
const PropTypes = require('prop-types');

/**
 * @class StyletronProvider
 * @packagename styletron-react
 * @description React component
 * @example
 * const Styletron = require('styletron');
 *
 * function render() {
 *   return React.renderToString(
 *     <StyletronProvider styletron={new Styletron()}>
 *       <App/>
 *     </StyletronProvider>
 *   );
 * }
 * 
 * @property {object} styletron - Styletron instance
 * @property {ReactElement} children - children
 * @extends ReactClass
 */
class StyletronProvider extends React.Component {
  getChildContext() {
    return {styletron: this.styletron};
  }
  constructor(props, context) {
    super(props, context);
    this.styletron = props.styletron;
  }
  render() {
    return React.Children.only(this.props.children);
  }
}

StyletronProvider.PropTypes = {
  styletron: PropTypes.object.isRequired,
  children: PropTypes.element.isRequired
};

StyletronProvider.childContextTypes = {
  styletron: PropTypes.object.isRequired
};

module.exports = StyletronProvider;
