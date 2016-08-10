var BigDIVA = {};
	
BigDIVA.IntroDialog = function() {
    this.initialize.apply(this, arguments);
};

_.extend( BigDIVA.IntroDialog.prototype, {

  maxWidth: 3600,
  maxHeight: 1600,
  margin: 200,
  padding: 60,
  lastStep: 10,
                        
	initialize: function() {			    
    _.bindAll( this, 'resizeDialog', 'onNextStep', 'onClose' );
    this.currentStep = 1;
	},
  
  
  // dialog needs to be positioned and sized based on size of window
  resizeDialog: function() {
    var windowWidth = $(window).width();
    var windowHeight = $(window).height();
    
    var windowAspect = (windowWidth - (this.margin*2)) / (windowHeight - (this.margin*2));
    var naturalAspect = this.maxWidth / this.maxHeight;
    
    var dialogWidth, dialogHeight;

    if( windowAspect > naturalAspect ) {
      // scale based on height of window
      if( windowHeight >= this.maxHeight ) {
        dialogWidth = this.maxWidth;
        dialogHeight = this.maxHeight;      
      } else {
        dialogHeight = windowHeight - (this.margin*2);
        dialogWidth = this.maxWidth * (dialogHeight/this.maxHeight);
      }
    } else {
      // scale based on width of window
      if( windowWidth >= this.maxWidth ) {
        dialogWidth = this.maxWidth;
        dialogHeight = this.maxHeight;      
      } else {
        dialogWidth = windowWidth - (this.margin*2);
        dialogHeight = this.maxHeight * (dialogWidth/this.maxWidth);
      }
    }
    
    var introDialog = $('#intro-dialog');
    introDialog.width(dialogWidth);
    introDialog.height(dialogHeight);
    introDialog.offset({ top: this.margin, left: this.margin });
    
    var introStep = $('.intro-step');
    introStep.width(dialogWidth-this.padding);
    introStep.height(dialogHeight-this.padding);
    
    var nextStepX = dialogWidth - 40 + this.margin;
    var nextStepY = dialogHeight/2 + this.margin - 20;
    
    $('#next-step').offset({ top: nextStepY, left: nextStepX});
  },
  
  onNextStep: function() {    
    if( this.currentStep < this.lastStep ) {
      this.currentStep =  this.currentStep + 1;
      this.selectStep(this.currentStep);
    } else {
      this.checkDoNotShow();
      $('#intro-dialog').hide();
    }
  },
  
  onClose: function() {
    this.checkDoNotShow();
    $('#intro-dialog').hide();
  },
  
  checkDoNotShow: function() {
    var doNotShow = $('#do-not-show-check:checked').val();
    
    // disable dialog for next time
    if( doNotShow ) {
      Cookies.set('big_diva_intro_skip', 'true');
    }
  },
  
  selectStep: function( stepNumber ) {    
    $('.intro-step').hide();
    $('#step-'+stepNumber).show();
  },
             
	render: function() {

    this.resizeDialog();

    // intro dialog is a multistep wizard. 
    this.selectStep(this.currentStep);

		// track on window resize
		$(window).resize(this.resizeDialog);
    
    $("#next-step-button").click(this.onNextStep);
    $("#close-x-button").click(this.onClose)
		
	}
  					
});