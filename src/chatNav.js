require('./chatNav.css');
var $ = require('jquery');

$('#whi').keydown(function(e) {
	if (e.which == 13) $("input[style='width: 15px;']").click();
});
