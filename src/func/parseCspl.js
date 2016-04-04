var each = require('lodash/each');
var concat = require('lodash/concat');
var zip = require('lodash/zip');
var split = require('lodash/split');
var map = require('lodash/map');

var parseSeg = require('./parseSeg.js');

module.exports = function(str, loc) {
	var colors = [], segs = str.split(' '), ret = -1, rloc = 0;
	try {
		each(segs, function(seg) {
			var r = /^([A-Za-z0-9_\-~().]+)=(.*)$/.exec(seg), n = colors.length - 1;
			if (r) colors.push([r[1], r[2]]);
			else if (n < 0) throw false;
			else colors[n][1] = colors[n][1] + ' ' + seg;
			if (rloc > -1) {
				if (rloc >= loc) { loc = ret; rloc = -1; }
				else {
					rloc = rloc + 1 + seg.length;
					if (r) ret = ret + r[1].length;
				}
			}
		});
		segs = []; ret = []; rloc = -1;
		each(colors, function(part) {
			var seg = part[0], str = part[1];
			segs = concat(segs, zip(split(seg, ''), parseSeg(seg.length, str)));
		});
	} catch (e) { if (e === false) return [str, false, str.length]; else throw e; }
	each(segs, function(seg) {
		var n = ret.length - 1;
		if (n < 0) ret.push(seg);
		else if (seg[1] == ret[n][1]) {
			ret[n] = [ret[n][0]+seg[0], seg[1]];
			loc = loc - 1;
		} else ret.push(seg);
	});
	ret = map(ret, function(v) {
		v = v[0] + '=' + v[1];
		if (loc > -1) {
			rloc = rloc + 1 + v.length; loc = loc - 1;
		}
		return v;
	}).join(' ');
	return [ret, true, rloc];
};
