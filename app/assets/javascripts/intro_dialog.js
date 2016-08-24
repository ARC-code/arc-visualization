var BigDIVA = {};
	
BigDIVA.IntroDialog = function() {
    this.initialize.apply(this, arguments);
};

_.extend( BigDIVA.IntroDialog.prototype, {

  maxWidth: 3119,
  maxHeight: 1334,
  padding: 60,
  lastStep: 10,
  margin: 200,
                        
	initialize: function() {			    
    _.bindAll( this, 'resizeDialog', 'onNextStep', 'onPrevStep', 'onClose' );
    this.currentStep = 1;
	},
  
  
  // dialog needs to be positioned and sized based on size of window
  resizeDialog: function() {
    var windowWidth = $(window).width();
    var windowHeight = $(window).height();
    
    var windowAspect = (windowWidth - (this.margin*2)) / (windowHeight - (this.margin*2));
    var naturalAspect = this.maxWidth / this.maxHeight;
    
    var dialogWidth, dialogHeight;
    var dialogX, dialogY;

    if( windowAspect > naturalAspect ) {
      // scale based on height of window      
      dialogHeight = windowHeight - (this.margin*2);
      dialogWidth = this.maxWidth * (dialogHeight/this.maxHeight);
    } else {
      // scale based on width of window
      dialogWidth = windowWidth - (this.margin*2);
      dialogHeight = this.maxHeight * (dialogWidth/this.maxWidth);
    }

    var introDialog = $('#intro-dialog');
    dialogX = (windowWidth/2) - (dialogWidth/2);
    dialogY = (windowHeight/2) - (dialogHeight/2);
    introDialog.width(dialogWidth);
    introDialog.height(dialogHeight);
    introDialog.offset({ top: dialogY, left: dialogX });
        
    var introStep = $('.intro-step');
    introStep.width(dialogWidth-this.padding);
    introStep.height(dialogHeight-this.padding);
    
    var stepButtonWidth = $('#next-step').width();
    var prevStepX = dialogX + 5;
    var nextStepX = dialogWidth + dialogX + this.padding - 10 - stepButtonWidth*2;
    var nextStepY = dialogHeight/2 + dialogY - 20;
    
    $('#prev-step').offset({ top: nextStepY, left: prevStepX});
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
  
  onPrevStep: function() {    
    if( this.currentStep > 1 ) {
      this.currentStep =  this.currentStep - 1;
      this.selectStep(this.currentStep);
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
    
    if( stepNumber == 1 ) {
      $('#prev-step').hide();
    } else {
      $('#prev-step').show();
      this.resizeDialog();
    }    
  },
             
	render: function() {

    this.resizeDialog();

    // intro dialog is a multistep wizard. 
    this.selectStep(this.currentStep);

		// track on window resize
		$(window).resize(this.resizeDialog);
    
    $("#prev-step-button").click(this.onPrevStep);
    $("#next-step-button").click(this.onNextStep);
    $("#close-x-button").click(this.onClose)
		
	}
  					
});