/* globals _, $ */
/* exported clrs */

var page = false, esc = _.escape, helpData = {
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
		cspl('Username', 'f00 db0024 b60049 92006d 6d0092 4900b6 2400db 00f'),
		' /cspl conf Username=red/blue', br(),
		'You can create a gradient in your cSplit by using / to seperate colors.',
		br(), br(),
		cspl('Username', 'f00 a05 50a 00f ffd700 eacf40 d5c880 c0c0c0'),
		' /cspl conf User=red/blue name=gold/silver', br(),
		'You can have multiple gradients in your cSplit, just like you can have multiple colors in regular cSplit configurations.',
		br(), br(),
		cspl('Username', 'f00 b62500 6d4900 246e00 006e24 00496d 0025b6 00f'),
		' /cspl conf Username=red/green/blue', br(),
		"Gradients aren't limited to only one color, either!",
		br(), br(),
		cspl('Username', 'f00 ff9200 dbff00 49ff00 00ff49 00ffdb 0092ff 00f'),
		' /cspl conf Username=hsv:red/blue', br(),
		'You can also use HSV gradients if you want.',
		br(), br(),
		cspl('Username', 'f00 fdba14 a0fa27 3af855 4df5dd 5f9ef3 9571f0 ee82ee'),
		' /cspl conf Username=rainbow', br(),
		'You can also have a rainbow cSplit! This is actually the same as: /cspl conf Username=hsv:red/violet',
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
		clr('Username', 'daa520'), ' goldenrod', br(),
		clr('Username', 'e4b849'), ' goldenrod;lighten', br(),
		clr('Username', 'ebc975'), ' goldenrod;lighten20', br(),
		br(),
		clr('Username', 'daa520'), ' goldenrod', br(),
		clr('Username', 'f3be39'), ' goldenrod;brighten', br(),
		clr('Username', 'ffd853'), ' goldenrod;brighten20', br(),
		br(),
		clr('Username', 'daa520'), ' goldenrod', br(),
		clr('Username', 'ad8319'), ' goldenrod;darken', br(),
		clr('Username', '816213'), ' goldenrod;darken20', br(),
		br(),
		clr('Username', 'daa520'), ' goldenrod', br(),
		clr('Username', 'cda02c'), ' goldenrod;desaturate', br(),
		clr('Username', 'c19a39'), ' goldenrod;desaturate20', br(),
		br(),
		clr('Username', 'daa520'), ' goldenrod', br(),
		clr('Username', 'e6aa13'), ' goldenrod;saturate', br(),
		clr('Username', 'f3b007'), ' goldenrod;saturate20', br(),
		br(),
		clr('Username', 'da20b2'), ' goldenrod;spin-90', br(),
		clr('Username', 'daa520'), ' goldenrod', br(),
		clr('Username', '20da48'), ' goldenrod;spin90', br(),
		clr('Username', '2055da'), ' goldenrod;spin180', br(),
		clr('Username', 'da20b2'), ' goldenrod;spin270', br(),
		br(),
		clr('Username', '7d7d7d'), ' goldenrod;grayscale', br(),
		'Note: "greyscale" can be used as well, for those brits out there. ;)', br()
	]
};

// Converts "/cspl conf" format to be used for cspl()
// Requires the input to be generated cSplit, not extended cSplit.
// Use if the /cspl page needs to be changed.
function clrs(txt) {
	if (_.startsWith(txt, '/cspl conf ')) txt = txt.substr(11);
	return _.join(_.map(_.split(_.trim(txt), ' '), function(v) {
		var n = _.split(v, '#'); v = n[1];
		if (v[0] == v[1] && v[2] == v[3] && v[4] == v[5])
			v = v[0] + v[2] + v[4];
		return _.trim(_.repeat(v + ' ', n[0].length - 1));
	}), ' ');
}

function br() { return $('<br>'); }
function btn(id, txt) {
	var btn = $('<button/>', {text: txt || id, click: function() { openPage(id); }});
	_.defer(function() { btn.text(txt || (helpData[_.toLower(id)] || [])[0] || id); });
	return btn;
}
function lnk(id, txt) {
	var a = $('<a/>', {text: txt || id, href: '#'+id});
	_.defer(function() { a.text(txt || (helpData[_.toLower(id)] || [])[0] || id); });
	return a;
}
function cspl(txt, clrs) {
	return $('<b/>').html($('<u/>').html(
		_([_.split(txt, ''), _.split(clrs, ' ')]).unzip().map(function(v) {
			return $('<span/>', {text: v[0], css: {color: '#'+v[1]}});
		}).push(':').value()
	));
}
function clr(txt, clr) {
	return $('<span/>', {css: {color: '#'+clr}}).html($('<b/>').html($('<u/>').html(txt+':')));
}
function openPage(id) {
	id = _.toLower(id); location.hash = '#'+id; if (id == page) return;
	var content = _.cloneDeepWith(helpData[id] || ['Not Found', 'Page not found.'], function(v) {
		if (v instanceof jQuery) return $(v).clone(true);
	}), title = content.shift() || id;
	if (page === false) $('#title').text(title);
	else if (_.isNull(page)) {
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
window.onhashchange(); _.defer(function() { page = null; window.onhashchange(); });
