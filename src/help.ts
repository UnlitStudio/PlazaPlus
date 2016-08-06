import * as _ from 'lodash';
import * as $ from 'jquery';
import parseCspl from './func/parseCspl';
import parseColor from './func/parseColor';

type HelpLine = JQuery | string;
type HelpPage = HelpLine[];
class HelpData {
	constructor(public title: string, public data: () => HelpPage) {};
}

var page: boolean | string = false, helpData: {[id: string]: HelpData} = {};
helpData['404'] = new HelpData('Not Found', () => [
	'Page not found.', br(),
	lnk('home', 'Return to Home')
]);
helpData['home'] = new HelpData('Home', () => [
	'Welcome to Plaza+! To get started, here are some useful help pages to look at:', br(),
	'Click on a link or button to open that page.', br(),
	br(),
	lnk('commands'), ': Learn some of the useful (and random) Plaza+ commands.', br(),
	lnk('destinations'), ': Learn how to multitask like a pro.'
]);
helpData['commands'] = new HelpData('Commands', () => [
	'/+ver - Shows you the version of Plaza+ being run', br(),
	'/whisperto - A convenience shortcut for /whisper', br(),
	'/reply [msg] - Reply to the last whisper you received', br(),
	'/ignore <user> - Ignore a user by username', br(),
	'/unignore <user> - Opposite of /ignore', br(),
	'/overraeg - Raeg with no message showing', br(),
	'/pm <user> <subject> - Send a private message', br(),
	btn('/alias'), ' - Set aliases for use in Plaza+ commands', br(),
	'/room <chatroom> - Quickly switch to a different chatroom', br(),
	'/transfer <amount> <user> - Transfer 3DSPoints', br(),
	'/slap [user] - Slap someone with something smelly', br(),
	'/rptag [tag] - Set your RP tag', br(),
	btn('/focus'), " - Focus on certain users' chats", br(),
	btn('/cspl'), ' - Extended cSplit'
]);
helpData['destinations'] = new HelpData('Destinations', () => [
		'Plaza+ adds 5 textboxes to the chatrooms. ',
		'You can switch between textboxes by pressing up and down, ',
		'or by clicking the colored tabs above the textbox. ',
		'Each textbox is set to a destination (chat by default), ',
		'which can be changed by using certain comamnds. These commands usually accept a message, ',
		'which will use the destination once without setting it. ',
		'The commands are found below:', br(),
		br(),
		'/chat [msg] - Chat. Simple as that.', br(),
		'/echo [msg] - Mostly for testing, this will repeat your messages back to you.', br(),
		'/whisperto <user> [msg] - Whisper a user.'
]);
helpData['/alias'] = new HelpData('/alias', () => [
	'This command allows you to set aliases on users for use in Plaza+ commands. ',
	'Note that you can set aliases in options as well.', br(),
	br(),
	'/alias - Display a list of all set aliases.', br(),
	'/alias <alias> - Delete the specified alias.', br(),
	'/alias <alias> <username> - Set the specified alias to the specified user.'
]);
helpData['/focus'] = new HelpData('/focus', () => [
	'This will blur all chats from users not on the focus list. Useful for roleplaying.', br(),
	br(),
	'/focus - Display focus list.', br(),
	'/focus <user, ...> - Add or remove users from the focus list.', br(),
	'/focus clear - Clears focus list.', br(),
	'/focus blur - Sets focus to blur mode (default).', br(),
	'/focus shrink - Sets focus to shrink mode.', br(),
	'/focus hide - Sets focus to hide mode.'
]);
helpData['/cspl'] = new HelpData('/cspl', () => [
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
	'Plaza+ also adds a cSplit stealer: /cspl steal <user> [your username]', br(),
	'Note: If you specify an alias with the tag "Me", you don\'t have to provide your username.'
]);
helpData['colors'] = new HelpData('Color Filters', () => [
	'When specifying colors for cSplit or elsewhere, you can use filters to transform the colors. ',
	'To use a filter, use ;<filter>[value] after the color. ',
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
	'Note: "greyscale" can be used as well, for those brits out there. ;)'
]);

function br() { return $('<br>'); }
function btn(id: string, txt?: string) {
	var btn = $('<button/>').click(function() { openPage(id); });
	btn.text(txt || (helpData[_.toLower(id)] || new HelpData(id, () => [])).title);
	return btn;
}
function lnk(id: string, txt?: string) {
	var a = $('<a/>', {href: '#'+id});
	a.text(txt || (helpData[_.toLower(id)] || new HelpData(id, () => [])).title);
	return a;
}
function cspl(txt: string) {
	var cspl = (parseCspl(txt))[0];
	return $('<span/>').append($('<b/>').append($('<u/>').append(
		_(cspl).split(' ').map(function(v: string) {
			var a = _.split(v, '='); return $('<span/>', {text: a[0], css: {color: a[1]}});
		}).concat([':']).value()
	))).append(' /cspl conf '+txt);
}
function clr(txt: string, col: string) {
	var clr = parseColor(col);
	return $('<span/>').append(
		$('<span/>', {css: {color: clr}}).append($('<b/>').append($('<u/>').html(txt+':')))
	).append(' '+col);
}
function openPage(id: string) {
	id = _.toLower(id); location.hash = '#'+id; if (id == page) return;
	var data: HelpData = helpData[id] || helpData['404'];
	var content = data.data(), title = data.title;
	content = _.map(content, function(v: any) { return _.isString(v) ? _.escape(v) : v; });
	if (page === false) $('#title').text(title);
	else if (_.isNull(page)) {
		$('#title').text(title); $('#content').append(content).hide().fadeIn('fast');
	} else {
		$('#title').fadeOut(function() { $('#title').text(title).fadeIn(); });
		$('#content').slideUp(function() { $('#content').empty().append(content).slideDown(); });
	}
	page = id;
}
var hashFunc = function() {
	var id = 'home';
	if (location.hash.substr(0, 1) == '#') id = location.hash.substr(1);
	openPage(id);
};
window.onhashchange = hashFunc;

$('#goHome').click(function() { openPage('home'); });
hashFunc(); _.defer(function() { page = null; hashFunc(); });
