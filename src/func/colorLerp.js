var clamp = require('lodash/clamp');
var tinycolor = require('tinycolor2');

module.exports = function(t, cols, hsv) {
	var c = cols.length - 1; t = t * c; if (c === 0) return cols[0];
	var i = clamp(Math.floor(t), 0, c-1); t = t - i;
	var s = cols[i], e = cols[i+1], lerp = function(s,e) { return (1-t)*s+t*e; };
	if (hsv) {
		s = s.toHsv(); e = e.toHsv();
		return tinycolor({h: lerp(s.h, e.h), s: lerp(s.s, e.s), v: lerp(s.v, e.v)});
	} else {
		s = s.toRgb(); e = e.toRgb();
		return tinycolor({r: lerp(s.r, e.r), g: lerp(s.g, e.g), b: lerp(s.b, e.b)});
	}
};
