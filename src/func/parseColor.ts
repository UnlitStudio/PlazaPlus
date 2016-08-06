import * as _ from 'lodash';
import * as tinycolor from 'tinycolor2';

export default _.memoize(function(color: string) {
	var filts = color.split(';'); color = filts.shift();
	var col = /^\s*rand(om)?\s*$/i.exec(color) ? tinycolor.random() : tinycolor(color);
	if (!col.isValid()) return undefined;
	return _.reduce(_.map(filts, function(v) { return _.trim(_.toLower(v)); }), _.cond(
		_.concat([[_.partial(_.eq, _, false), _.constant(false)]],
			_.map(['lighten','brighten','darken','desaturate','saturate','spin'], function(t) {
				return [
					_.rearg(_.partial(_.startsWith, _, t), 1),
					function(c: tinycolorInstance, f: string) {
						var s = t == 'spin', d = s ? 0 : 10, n = _.toNumber(f.substr(t.length) || d);
						return c[t](isNaN(n) ? d : _.clamp(n, s ? -360 : 0, s ? 360 : 100));
					}
				];
			}), [
				[
					function(c: tinycolorInstance, f: string) { return /^gr[ae]y(scale)?$/.exec(f); },
					function(c: tinycolorInstance) { return c.greyscale(); }
				], [_.constant(true), _.constant(false)]
			]
		)
	), col);
}, function(col: string) { return /^\s*rand(om)?\s*(;|$)/i.exec(col) ? _.uniqueId() : '>'+col; });
