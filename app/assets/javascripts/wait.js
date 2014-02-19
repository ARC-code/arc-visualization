
var showWaitPopup = function() {
   $("#dim-overlay").show();
   $("#working").show();
   $("#working").css('z-index', 5000);
};

var hideWaitPopup = function() {
   $("#dim-overlay").hide();
   $("#working").hide();
};