import * as _ from 'lodash';

export default function(v: string) {
	switch (_.toLower(v)) {
		case 'v3original': return 'Original';
		case 'v3rp': return 'RP';
		case 'r9k': return 'ROBOT9000';
		default: return v;
	}
};
