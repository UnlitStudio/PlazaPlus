import * as $ from 'jquery';
import './chatNav.css';

$('#whi').keydown(function(e) {
	if (e.which == 13) $("input[style='width: 15px;']").click();
});
