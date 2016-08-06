import * as _ from 'lodash';
import parseSeg from './parseSeg';

export default function(str: string, loc = 0): [string, boolean, number] {
	var colors: [string, string][] = [];
	var segs: string[] = str.split(' ');
	var pos = -1, rloc = 0;
	try {
		_.each(segs, function(seg) {
			var r = /^([A-Za-z0-9_\-~().]+)=(.*)$/.exec(seg), n = colors.length - 1;
			if (r) colors.push([r[1], r[2]]);
			else if (n < 0) throw false;
			else colors[n][1] = colors[n][1] + ' ' + seg;
			if (rloc > -1) {
				if (rloc >= loc) { loc = pos; rloc = -1; }
				else {
					rloc = rloc + 1 + seg.length;
					if (r) pos = pos + r[1].length;
				}
			}
		});
		var parts: string[][] = []; var ret: string[][] = []; rloc = -1;
		_.each(colors, function(part) {
			var seg = part[0], str = part[1];
			parts = _.concat(parts, _.zip(_.split(seg, ''), parseSeg(seg.length, str)));
		});
	} catch (e) { if (e === false) return [str, false, str.length]; else throw e; }
	_.each(parts, function(seg) {
		var n = ret.length - 1;
		if (n < 0) ret.push(seg);
		else if (seg[1] == ret[n][1]) {
			ret[n] = [ret[n][0]+seg[0], seg[1]];
			loc = loc - 1;
		} else ret.push(seg);
	});
	var cspl = _.map(ret, function(r) {
		var v = r[0] + '=' + r[1];
		if (loc > -1) {
			rloc = rloc + 1 + v.length; loc = loc - 1;
		}
		return v;
	}).join(' ');
	return [cspl, true, rloc];
};
