var trim = require('lodash/trim');
var toLower = require('lodash/toLower');
var startsWith = require('lodash/startsWith');
var map = require('lodash/map');
var times = require('lodash/times');

var parseColor = require('./parseColor.js');
var colorLerp = require('./colorLerp.js');

module.exports = function(len, str) {
	var kw = trim(toLower(str)), hsv = true;
	if (kw == 'rainbow') str = 'hsv:red/violet';
	else hsv = startsWith(kw, 'hsv:');
	if (startsWith(kw, 'rgb:') || hsv) str = str.substr(4);
	var cols = map(str.split('/'), parseColor);
	return times(len, function(i) { return colorLerp(i/(len-1), cols, hsv).toHexString(); });
};
