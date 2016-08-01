// if cookie is not set, then display the intro dialog

// intro dialog is a multistep wizard which maintains constant size and a position in center of display. It may be dismissed at any time.

// if don't show this again is checked, set the cookie

var BigDIVA = {};
	
BigDIVA.IntroDialog = function() {
    this.initialize.apply(this, arguments);
};

_.extend( BigDIVA.IntroDialog.prototype, {

  maxWidth: 3600,
  maxHeight: 1600,
  margin: 200,
  padding: 50,
                        
	initialize: function() {			    
    _.bindAll( this, 'resizeDialog');
	},
  
  resizeDialog: function() {
    var windowWidth = $(window).width();
    var windowHeight = $(window).height();
    
    var dialogWidth, dialogHeight;
    if( windowWidth >= this.maxWidth ) {
      dialogWidth = this.maxWidth;
      dialogHeight = this.maxHeight;      
    } else {
      dialogWidth = windowWidth - (this.margin*2);
      dialogHeight = this.maxHeight * (dialogWidth/this.maxWidth);
    }
    
    var introDialog = $('#intro-dialog');
    introDialog.width(dialogWidth);
    introDialog.height(dialogHeight);
    introDialog.offset({ top: this.margin, left: this.margin });
    
    var introStep = $('.intro-step');
    introStep.width(dialogWidth-this.padding);
    introStep.height(dialogHeight-this.padding);
  },
  
  selectStep: function( stepNumber ) {    
    $('.intro-step').hide();
    $('#step-'+stepNumber).show();
  },
             
	render: function() {
    
    // dialog needs to be positioned and sized based on size of window
    
    // scale factor that scales all graphics proportionally based on width
    this.resizeDialog();
    
    this.selectStep(10);

		// track on window resize
		$(window).resize(this.resizeDialog);
		
	}
  					
});