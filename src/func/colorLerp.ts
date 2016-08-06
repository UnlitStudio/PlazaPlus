import * as _ from 'lodash';
import * as tinycolor from 'tinycolor2';

export default function(t: number, cols: tinycolorInstance[], hsv?: boolean) {
	var c = cols.length - 1; t = t * c; if (c === 0) return cols[0];
	var i = _.clamp(Math.floor(t), 0, c-1); t = t - i;
	var a = cols[i], b = cols[i+1], lerp = function(s: number, e: number) { return (1-t)*s+t*e; };
	if (hsv) {
		let s = a.toHsv(), e = b.toHsv();
		return tinycolor({h: lerp(s.h, e.h), s: lerp(s.s, e.s), v: lerp(s.v, e.v)});
	} else {
		let s = a.toRgb(), e = b.toRgb();
		return tinycolor({r: lerp(s.r, e.r), g: lerp(s.g, e.g), b: lerp(s.b, e.b)});
	}
};
