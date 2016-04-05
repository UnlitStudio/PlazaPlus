var $ = require('jquery');
var startsWith = require('lodash/startsWith');
var join = require('lodash/join');
var map = require('lodash/map');
var split = require('lodash/split');
var trim = require('lodash/trim');
var repeat = require('lodash/repeat');
var defer = require('lodash/defer');
var toLower = require('lodash/toLower');
var constant = require('lodash/constant');
var cloneDeepWith = require('lodash/cloneDeepWith');
var isNull = require('lodash/isNull');

var parseCspl = require('./func/parseCspl.js');
var parseColor = require('./func/parseColor.js');

var page = false, esc = require('lodash/escape'), helpData = {
	home: ['Home',
		'Welcome to Plaza+! To get started, here are some useful help pages to look at:', br(),
		'Click on a link or button to open that page.', br(),
		br(),
		lnk('commands'), ': Learn some of the useful (and random) Plaza+ commands.', br(),
		lnk('destinations'), ': Learn how to multitask like a pro.'
	], commands: ['Commands',
		'/+ver - Shows you the version of Plaza+ being run', br(),
		'/whisperto - A convenience shortcut for /whisper', br(),
		'/reply [msg] - Reply to the last whisper you received', br(),
		esc('/ignore <user> - Ignore a user by username'), br(),
		esc('/unignore <user> - Opposite of /ignore'), br(),
		'/overraeg - Raeg with no message showing', br(),
		esc('/pm <user> <subject> - Send a private message'), br(),
		btn('/alias'), ' - Set aliases for use in Plaza+ commands', br(),
		esc('/room <chatroom> - Quickly switch to a different chatroom'), br(),
		esc('/transfer <amount> <user> - Transfer 3DSPoints'), br(),
		'/slap [user] - Slap someone with something smelly', br(),
		'/rptag [tag] - Set your RP tag', br(),
		btn('/focus'), " - Focus on certain users' chats", br(),
		btn('/cspl'), ' - Extended cSplit'
	], destinations: ['Destinations',
		'Plaza+ adds 5 textboxes to the chatrooms. ',
		'You can switch between textboxes by pressing up and down, ',
		'or by clicking the colored tabs above the textbox.', br(),
		'Each textbox is set to a destination (chat by default), ',
		'which can be changed by using certain comamnds. These commands usually accept a message, ',
		'which will use the destination once without setting it.', br(),
		'The commands are found below:', br(),
		br(),
		'/chat [msg] - Chat. Simple as that.', br(),
		'/echo [msg] - Mostly for testing, this will repeat your messages back to you.', br(),
		esc('/whisperto <user> [msg] - Whisper a user.')
	], '/alias': [null,
		'This command allows you to set aliases on users for use in Plaza+ commands. ',
		'Note that you can set aliases in options as well.', br(),
		br(),
		'/alias - Display a list of all set aliases.', br(),
		esc('/alias <alias> - Delete the specified alias.'), br(),
		esc('/alias <alias> <username> - Set the specified alias to the specified user.')
	], '/focus': [null,
		'This will blur all chats from users not on the focus list. Useful for roleplaying.', br(),
		br(),
		'/focus - Display focus list.', br(),
		esc('/focus <user, ...> - Add or remove users from the focus list.'), br(),
		'/focus clear - Clears focus list.', br(),
		'/focus blur - Sets focus to blur mode (default).', br(),
		'/focus shrink - Sets focus to shrink mode.', br(),
		'/focus hide - Sets focus to hide mode.'
	], '/cspl': [null,
		'Plaza+ makes cSplit configurations easier to create! ',
		'You can still use regular cSplit configurations with no problems, ',
		"but Plaza+ adds some extra options to cSplit's format:", br(),
		br(),
		cspl('Username=red/blue'), br(),
		'You can create a gradient in your cSplit by using / to seperate colors.',
		br(), br(),
		cspl('User=red/blue name=silver/gold'), br(),
		'You can have multiple gradients in your cSplit, just like you can have multiple colors in regular cSplit configurations.',
		br(), br(),
		cspl('User=gold/purple name=silver'), br(),
		'You can also mixmatch gradients and non-gradients.',
		br(), br(),
		cspl('Username=red/yellow/brown/blue'), br(),
		"Gradients aren't limited to only one color, either!",
		br(), br(),
		cspl('Username=hsv:gray/blue'), br(),
		'You can also use HSV gradients if you want.',
		br(), br(),
		cspl('Username=rainbow'), br(),
		'You can also have a rainbow cSplit! This is actually the same as:', br(),
		cspl('Username=hsv:red/violet'),
		br(), br(),
		cspl('User=red name=blue'), br(),
		"Regular cSplit configurations will still work just as you'd expect!",
		br(), br(),
		'If you want to get advanced, you can also apply filters to colors. ',
		'More details can be found on the ', lnk('colors'), ' page.', br(),
		br(),
		esc('Plaza+ also adds a cSplit stealer: /cspl steal <user> [your username]'), br(),
		'Note: If you specify an alias with the tag "Me", you don\'t have to provide your username.'
	], colors: ['Color Filters',
		'When specifying colors for cSplit or elsewhere, you can use filters to transform the colors. ',
		esc('To use a filter, use ;<filter>[value] after the color. '),
		'Value is an optional value from 0 to 100 that defaults to 10. For the spin filter, the value ',
		"is required and goes from -360 to 360. The grayscale filter doesn't accept a value. The ",
		'filters available are lighten, brighten, darken, desaturate, saturate, spin, and grayscale.',
		br(), br(),
		clr('Username', 'goldenrod'), br(),
		clr('Username', 'goldenrod;lighten'), br(),
		clr('Username', 'goldenrod;lighten20'), br(),
		br(),
		clr('Username', 'goldenrod'), br(),
		clr('Username', 'goldenrod;brighten'), br(),
		clr('Username', 'goldenrod;brighten20'), br(),
		br(),
		clr('Username', 'goldenrod'), br(),
		clr('Username', 'goldenrod;darken'), br(),
		clr('Username', 'goldenrod;darken20'), br(),
		br(),
		clr('Username', 'goldenrod'), br(),
		clr('Username', 'goldenrod;desaturate'), br(),
		clr('Username', 'goldenrod;desaturate20'), br(),
		br(),
		clr('Username', 'goldenrod'), br(),
		clr('Username', 'goldenrod;saturate'), br(),
		clr('Username', 'goldenrod;saturate20'), br(),
		br(),
		clr('Username', 'goldenrod;spin-90'), br(),
		clr('Username', 'goldenrod'), br(),
		clr('Username', 'goldenrod;spin90'), br(),
		clr('Username', 'goldenrod;spin180'), br(),
		clr('Username', 'goldenrod;spin270'), br(),
		br(),
		clr('Username', 'goldenrod;grayscale'), br(),
		'Note: "greyscale" can be used as well, for those brits out there. ;)', br()
	]
};

function br() { return $('<br>'); }
function btn(id, txt) {
	var btn = $('<button/>', {text: txt || id, click: function() { openPage(id); }});
	defer(function() { btn.text(txt || (helpData[toLower(id)] || [])[0] || id); });
	return btn;
}
function lnk(id, txt) {
	var a = $('<a/>', {text: txt || id, href: '#'+id});
	defer(function() { a.text(txt || (helpData[toLower(id)] || [])[0] || id); });
	return a;
}
function cspl(txt) {
	var cspl = (parseCspl(txt))[0];
	return $('<span/>').html($('<b/>').html($('<u/>').append(
		map(split(cspl, ' '), function(v) {
			v = split(v, '='); return $('<span/>', {text: v[0], css: {color: v[1]}});
		}).concat([':'])
	))).append(' /cspl conf '+txt);
}
function clr(txt, col) {
	var clr = parseColor(col);
	return $('<span/>').html(
		$('<span/>', {css: {color: clr}}).html($('<b/>').html($('<u/>').html(txt+':')))).append(' '+col);
}
function openPage(id) {
	id = toLower(id); location.hash = '#'+id; if (id == page) return;
	var content = cloneDeepWith(helpData[id] || ['Not Found', 'Page not found.'], function(v) {
		if (v instanceof $) return $(v).clone(true);
	}), title = content.shift() || id;
	if (page === false) $('#title').text(title);
	else if (isNull(page)) {
		$('#title').text(title); $('#content').html(content).hide().fadeIn('fast');
	} else {
		$('#title').fadeOut(function() { $('#title').text(title).fadeIn(); });
		$('#content').slideUp(function() { $('#content').html(content).slideDown(); });
	}
	page = id;
}
window.onhashchange = function() {
	var id = 'home';
	if (location.hash.substr(0, 1) == '#') id = location.hash.substr(1);
	openPage(id);
};

$('#goHome').click(function() { openPage('home'); });
window.onhashchange(); defer(function() { page = null; window.onhashchange(); });
