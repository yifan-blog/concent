"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports["default"] = void 0;

var _ccContext = _interopRequireDefault(require("../cc-context"));

var _computedValue = _ccContext["default"].computed._computedValue;

var _default = function _default(module) {
  if (module) return _computedValue[module];else return _computedValue;
};

exports["default"] = _default;