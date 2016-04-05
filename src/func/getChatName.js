var toLower = require('lodash/toLower');

module.exports = function(v) {
	switch (toLower(v)) {
		case 'v3original': return 'Original';
		case 'v3game': return 'Game';
		case 'v3red': return 'Red';
		case 'v3yellow': return 'Yellow';
		case 'v3green': return 'Green';
		case 'v3rp': return 'Roleplay';
		case 'v3rpaux': return 'Aux Roleplay';
		case 'r9k': return 'ROBOT9000';
		default: return v;
	}
};
