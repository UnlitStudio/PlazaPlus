import * as _ from 'lodash';
import * as tinycolor from 'tinycolor2';
import parseColor from './parseColor';
import colorLerp from './colorLerp';

export default function(len: number, str: string) {
	var kw = _.trim(_.toLower(str)), hsv = true;
	if (kw == 'rainbow') str = 'hsv:red/violet';
	else hsv = _.startsWith(kw, 'hsv:');
	if (_.startsWith(kw, 'rgb:') || hsv) str = str.substr(4);
	var cols = _.map(str.split('/'), function(v) { return parseColor(v) || tinycolor('black'); });
	return _.times(len, function(i) { return colorLerp(i/(len-1), cols, hsv).toHexString(); });
};
