var memoize = require('lodash/memoize');
var reduce = require('lodash/reduce');
var map = require('lodash/map');
var trim = require('lodash/trim');
var toLower = require('lodash/toLower');
var cond = require('lodash/cond');
var concat = require('lodash/concat');
var rearg = require('lodash/rearg');
var partial = require('lodash/partial');
var startsWith = require('lodash/startsWith');
var toNumber = require('lodash/toNumber');
var isNaN = require('lodash/isNaN');
var clamp = require('lodash/clamp');
var constant = require('lodash/constant');
var eq = require('lodash/eq');
var uniqueId = require('lodash/uniqueId');
var _ = partial.placeholder;

var tinycolor = require('tinycolor2');

module.exports = memoize(function(col) {
	var filts = col.split(';'); col = filts.shift();
	col = /^\s*rand(om)?\s*$/i.exec(col) ? tinycolor.random() : tinycolor(col);
	if (!col.isValid()) return false;
	return reduce(map(filts, function(v) { return trim(toLower(v)); }), cond(
		concat([[partial(eq, _, false), constant(false)]],
			map(['lighten','brighten','darken','desaturate','saturate','spin'], function(t) {
				return [
					rearg(partial(startsWith, _, t), 1),
					function(c, f) {
						var s = t == 'spin', d = s ? 0 : 10, n = toNumber(f.substr(t.length) || d);
						return c[t](isNaN(n) ? d : clamp(n, s ? -360 : 0, s ? 360 : 100));
					}
				];
			}), [
				[
					function(c, f) { return /^gr[ae]y(scale)?$/.exec(f); },
					function(c) { return c.greyscale(); }
				], [constant(true), constant(false)]
			]
		)
	), col);
}, function(col) { return /^\s*rand(om)?\s*(;|$)/i.exec(col) ? uniqueId() : '>'+col; });
