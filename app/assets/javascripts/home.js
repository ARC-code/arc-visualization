/*global $, d3, window */

//jQuery ismouseover  method
(function($){
   $.mlp = {x:0,y:0}; // Mouse Last Position
   function documentHandler(){
      var $current = this === document ? $(this) : $(this).contents();
      $current.mousemove(function(e){jQuery.mlp = {x:e.pageX,y:e.pageY}});
   }
   $(documentHandler);
   $.fn.ismouseover = function(pad) {
      if (typeof pad == 'undefined') {
         pad = 0;
      }
      var result = false;
      this.eq(0).each(function() {
         var $current = $(this);
         var offset = $current.offset();
         result =    (offset.left - pad)<=$.mlp.x && (offset.left + $current.outerWidth() + pad) > $.mlp.x &&
            (offset.top - pad) <=$.mlp.y && (offset.top + $current.outerHeight() + pad) > $.mlp.y;
      });
      return result;
   };
})(jQuery);


$(function() {

   var dragging = false;
   var dragStarted = false;
   var domNode = null;
   var activeNode = false;
   var activeNodeD = false;
   var menuNode = false;
   var width = $(document).width();
   var height = $(document).height() - $("#site-header").outerHeight(true) - 10;
   var tipShowTimer = -1;
   var tipX;
   var tipY;
   var vis;
   var lastId = 0;
   var selectedNodeId = 0;
   var pzRect;
   var zoom;
   var gNodes;
   var gData;
   var rootMode = "archives";
   var filter = {
       searchQuery: "",
       date: ""
   };
   var dragMenu = {
       x: 0,
       y: 0,
       dragging: false
   };

   d3.selection.prototype.moveParentToFront = function() {
      return this.each(function(){
         var parent = this.parentNode;
         var grandparent = parent.parentNode;
         if (parent && grandparent) {
            grandparent.appendChild(parent);
         }
      });
   };

   d3.selection.prototype.moveToFront = function() {
      return this.each(function(){
         this.parentNode.appendChild(this);
      });
   };

   d3.selection.prototype.moveToBack = function() {
      return this.each(function() {
         var firstChild = this.parentNode.firstChild;
         if (firstChild) {
            this.parentNode.insertBefore(this, firstChild);
         }
      });
   };

   d3.selection.prototype.moveInFrontOf = function(selector) {
      var theChild = this.parentNode.select(selector);
      if (theChild) {
         return this.each(function() {
            this.parentNode.insertAfter(this, theChild);
         });
      }
   }

   d3.selection.prototype.moveBehind = function(selector) {
      var theChild = this.parentNode.select(selector);
      if (theChild) {
         return this.each(function() {
            this.parentNode.append(theChild);
         });
      }
   }
   $('.tabs .tab-links a').on('click', function(e)  {
      var currentAttrValue = $(this).attr('href');

      // Show/Hide Tabs
      $('.tabbed-panels ' + currentAttrValue).show().siblings().hide();

      // Change/remove current tab to active
      $(this).parent('li').addClass('selected').siblings().removeClass('selected');

      e.preventDefault();
   });

   function debug_log(msg) {
//			    if (msg[0] != '!') return;  // temporarily disable all but key messages
      var el = document.getElementById('debuglog');
      if (el) {
         el.innerHTML += (msg + '<br/>');
         el.scrollTop = el.scrollHeight;
      }
   }

   function nodeSize(d) {
      if (d.type == "root") {
         d3.select(this).classed("root", true);
         return 35;
      }
      if (d.type == "group" && d.children && d.children.length > 0) {
         return 15;
      }
      var sz = ""+ d.size;
      var extra = parseInt(sz.charAt(0),10);
      return sz.length*9+extra;
   }

   var hideMenu = function() {
      var d = $("#menu").data("target");
      if ( d ) {
         d3.select("#circle-" + d.id).classed("menu", false);
      }
      $("#menu").hide();
   };

   $(".titlebar").mousedown(function(e) {
      if (!dragMenu.dragging) {
         dragMenu.x = e.pageX;
         dragMenu.y = e.pageY;
         dragMenu.dragging = true;
      }
      return false;
   });

   $(window).mouseup(function(e) {
      if ( dragMenu.dragging ) {
         dragMenu.dragging = false;
         e.stopPropagation();
      }
   });

   $(window).mousemove(function(e) {
      if (dragMenu.dragging) {
         var dX = e.pageX - dragMenu.x;
         var dY = e.pageY - dragMenu.y;
         var off = $("#menu").offset();

         $("#menu").offset({
            left : (off.left + dX),
            top : (off.top + dY)
         });

         dragMenu.x = e.pageX;
         dragMenu.y = e.pageY;
      }
   });


   /**
    * REMOVE results for a previously expanded node
    */
   var clearFullResults = function(d) {
      d.results = null;
      gNodes = flatten(gData);
      updateVisualization(gNodes);
      var node = d3.select("#circle-"+d.id);
      node.classed("leaf", true);
      node.classed("parent", false);
      var sz = nodeSize(d);
      node.attr("r",  sz);
   };

   /**
    * REMOVE details for a previously expanded facet
    */
   var clearFacets = function(d) {
      d.children = null;
      d.choice = null;
      d.other_facets = null;
      gNodes = flatten(gData);
      updateVisualization(gNodes);
      var node = d3.select("#circle-"+d.id);
      node.classed("leaf", true);
      node.classed("parent", false);
      var sz = nodeSize(d);
      node.attr("r",  sz);
      $("#collapse").hide();
      $("#expand").hide();
   };

   /**
    * Examine the node to create a parameter string to reflect a query for the node
    * @param d
    * @returns a string with an HTTP GET request formatted list of parameters
    */
   var getFacetParams = function(d) {
      // determine the handle of the archive. it may be this node or a parent
      // when an archive has one of its facets expanded, those new nodes will
      // not have a handle; instead they have archive_handle which refers to the
      // parent archive
      var handle = d.handle;
      if ( !handle && d.archive_handle ) {
         handle = d.archive_handle;
      }

      // build the query string
      var params = "";
      var paramsArray = [];
      if ( handle ) {
         paramsArray.push("a="+handle);
      }
      if ( d.facet === "archive" || d.type == "type") {
         paramsArray.push("a="+d.name);
      }
      if ( d.facet === "genre" || d.type == "genre") {
         paramsArray.push("g="+d.name);
      }
      if ( d.facet === "discipline" || d.type == "discipline" ) {
         paramsArray.push("d="+d.name);
      }
      if ( d.facet === "doc_type" || d.type == "format") {
         paramsArray.push("t="+d.name);
      }
      if (d.other_facets) {
         if ( d.other_facets.genre ) {
            var genre = d.other_facets.genre.replace(/\+/g, "");
            paramsArray.push("g="+genre);
         }
         if ( d.other_facets.discipline ) {
            var discipline = d.other_facets.discipline.replace(/\+/g, "");
            paramsArray.push("d="+discipline);
         }
         if ( d.other_facets.doc_type ) {
            var doc_type = d.other_facets.doc_type.replace(/\+/g, "");
            paramsArray.push("t="+doc_type);
         }
         if ( d.other_facets.archive ) {
            var archive = d.other_facets.archive.replace(/\+/g, "");
            paramsArray.push("a="+archive);
         }
      }

      params = paramsArray.join("&");
      if (params.length > 0 ) {
         params = "&"+params;
         params = params.replace(/\s/g, "+");
      }
      return params;
   }

   /**
    * get results for a facet on the specified node
    */
   var getFullResults = function(d) {
      showWaitPopup();

      // if results have already been expanded for this node, remove them
      var childrenReset = false;
      if ( d.choice ) {
         d.children = null;
         d.choice = null;
         d.other_facets = null;
         childrenReset = true;
      }

      // build the query string
      var query = "/search?";
      var params = getFacetParams(d);
      if (d.page > 0) {
         params += "&pg=" + d.page;
      }

      // append the query/date stuff
      params = params + getSearchParams("&");

      var node = d3.select("#circle-"+d.id);
      d3.json(query+params, function(json) {
         if ( json !== null && json.length > 0 ) {
            node.classed("leaf", false);
            node.classed("parent", true);
            d.results = json;
            gNodes = flatten(gData);
            updateVisualization(gNodes);
         } else {
            if ( childrenReset === true ) {
               updateVisualization(gNodes);
            }
            node.classed("leaf", true);
            node.classed("parent", false);
            alert("No results found!");
         }
         hideWaitPopup();
      });
   };

   /**
    * get details for a facet on the specified node
    */
   var getFacetDetail = function(d, facetName) {
      showWaitPopup();

      // if facets have already been expanded for this node, remove them
	   var childrenReset = false;
	   if ( d.choice ) {
         d.children = null;
         d.choice = null;
         d.other_facets = null;
         childrenReset = true;
      }

      // build the query string
      var query = "/facet?f="+facetName;
      var params = getFacetParams(d);

      // append the query/date stuff
      params = params + getSearchParams("&");

      var node = d3.select("#circle-"+d.id);
      d3.json(query+params, function(json) {
         if ( json !== null && json.length > 0 ) {
            d.choice = facetName;
            node.classed("leaf", false);
            node.classed("parent", true);
            d.children = json;
            gNodes = flatten(gData);
//            node.attr("r", "15");
            updateVisualization(gNodes);
         } else {
            if ( childrenReset === true ) {
               updateVisualization(gNodes);
            }
            node.classed("leaf", true);
            node.classed("parent", false);
            if ( facetName === "doc_type") {
               facetName = "format";
            }
            alert("No results found for facet '"+facetName+"'");
         }
         hideWaitPopup();
      });
   };

   function stripZeroLen(node) {
      node.size = parseInt(node.size, 10);
      if (node.size === 0) {
         return true;
      }
      if (node.children) {
         var idx;
         var child;
         var len = node.children.length;
         while (len--) {
            child = node.children[len];
            child.size = parseInt(child.size, 10);
            if (child.size === 0) {
               node.children.splice(len, 1);
            } else {
               if (stripZeroLen(child)) {
                  node.children.splice(len, 1);
               }
            }
         }
      }
      return false;
   }

   function getSearchParams( prepend ) {
      var params = [];
      if ( filter.searchQuery.length > 0 ) {
         params.push(filter.searchQuery);
      }
      if ( filter.date.length > 0 ) {
         params.push(filter.date);
      }
      var p = params.join("&");
      if ( p.length > 0 ) {
         return prepend+p;
      }
      return "";
   }

   /**
    * Filter the results with data range and/or search terms
    */
   var filterData = function() {
      // grab the search terms (if any) and get them formatted
      filter.searchQuery = $("#query").val();
      if ( filter.searchQuery.length > 0) {
         filter.searchQuery = "q=%2b"+filter.searchQuery.replace(/\s/g, "%2b");
      }

      // grab and format the date range (if any)
      var q = $("#from").val();
      var to = $("#to").val();
      if ( q && q.length > 0 ) {
         if ( q.length !== 4 ) {
            alert("Please enter a 4 digit year in the from field");
            return;
         }
         if ( to && to.length > 0 ) {
            if ( to.length !== 4 ) {
               alert("Please enter a 4 digit year in the to field");
               return;
            }
            q = q + "-"+to;
         }
      }
      if ( q && q.length > 0 ) {
         filter.date = "y=%2b"+q.replace(/-/,"+TO+");
      }

      if ( filter.date.length === 0 && filter.searchQuery === 0) {
         return;
      }


      // filter the results
      showWaitPopup();
      d3.json("/search_"+rootMode+getSearchParams("?"), function(json) {
         if ( !json ) {
            alert("Unable to perform date filter");
         } else {
            gData = json;
            stripZeroLen(gData);
            gNodes = flatten(gData);
            updateVisualization(gNodes);
         }
         hideWaitPopup();
      });
   };
   $('.search input[type="text"]').keyup(function(e) {
      if (e.keyCode == 13) {
         filterData();
      }
   });
   $("#filter").on("click", function(e) {
      filterData();
   });

   /**
    * Pin toggle
    */
   $(".pin").on("click", function(e) {
      if (  $(".pin").hasClass("pinned" ) ) {
         $(".pin").removeClass("pinned" );
      }  else {
         $(".pin").addClass("pinned" );
      }
      e.preventDefault();
   });

   /**
    * Reset center and scale of fisualizarion
    */
   var recenter = function() {
      zoom.scale(1);
      zoom.translate([0,0]);
      vis.attr("transform","translate(0,0) scale(1)");
   };

   /**
    * Fully reset visualization
    */
   $("#reset").on("click", function() {
      filter.searchQuery = "";
      filter.date = "";
      showWaitPopup();
      hideMenu();
      hideTimeline();
      $("#query").val("");
      recenter();
      d3.json("/"+rootMode, function(json) {
         gData = json;
         gNodes = flatten(gData);
         updateVisualization(gNodes);
         hideWaitPopup();
      });
   });
   $("#recenter").on("click", function() {
      hideMenu();
      recenter();
   });
   $("#show-timeline-button").on("click", function() {
      showWaitPopup();
      d3.json("/"+rootMode+"?p=all", function(json) {
         // update all the data
         updatePeriodData(gNodes, json);
         updateVisualization(gNodes);
         showTimeline();
         hideWaitPopup();
      });
   });
   function hideTimeline() {
      $("footer").hide();
      $("#timeline-tabs").hide();
   }
   function showTimeline() {
      $("footer").show();
      $("#timeline-tabs").show();
   }


   /**
    * switch to archive-based visualization
    */
   $("#resource-block").on("click", function() {
//      filter.searchQuery = "";
//      filter.date = "";
      showWaitPopup();
      hideMenu();
      hideTimeline();
      $("#query").val("");
      recenter();
      rootMode = "archives";
      d3.json("/archives", function(json) {
         gData = json;
         gNodes = flatten(gData);
         updateVisualization(gNodes);
         hideWaitPopup();
         $("#resource-block").addClass('selected');
         $("#genre-block").removeClass('selected');
         $("#discipline-block").removeClass('selected');
         $("#format-block").removeClass('selected');
      });
   });

   /**
    * switch to genre-based visualization
    */
   $("#genre-block").on("click", function() {
//      filter.searchQuery = "";
//      filter.date = "";
      showWaitPopup();
      hideMenu();
      hideTimeline();
      $("#query").val("");
      recenter();
      rootMode = "genres";
      d3.json("/genres", function(json) {
         gData = json;
         gNodes = flatten(gData);
         updateVisualization(gNodes);
         hideWaitPopup();
         $("#resource-block").removeClass('selected');
         $("#genre-block").addClass('selected');
         $("#discipline-block").removeClass('selected');
         $("#format-block").removeClass('selected');
      });
   });

   /**
    * switch to discipline-based visualization
    */
   $("#discipline-block").on("click", function() {
//      filter.searchQuery = "";
//      filter.date = "";
      showWaitPopup();
      hideMenu();
      hideTimeline();
      $("#query").val("");
      recenter();
      rootMode = "disciplines";
      d3.json("/disciplines", function(json) {
         gData = json;
         gNodes = flatten(gData);
         updateVisualization(gNodes);
         hideWaitPopup();
         $("#resource-block").removeClass('selected');
         $("#genre-block").removeClass('selected');
         $("#discipline-block").addClass('selected');
         $("#format-block").removeClass('selected');
      });
   });

   /**
    * switch to format-based visualization
    */
   $("#format-block").on("click", function() {
//      filter.searchQuery = "";
//      filter.date = "";
      showWaitPopup();
      hideMenu();
      hideTimeline();
      $("#query").val("");
      recenter();
      rootMode = "formats";
      d3.json("/formats", function(json) {
         gData = json;
         gNodes = flatten(gData);
         updateVisualization(gNodes);
         hideWaitPopup();
         $("#resource-block").removeClass('selected');
         $("#genre-block").removeClass('selected');
         $("#discipline-block").removeClass('selected');
         $("#format-block").addClass('selected');
      });
   });

   // Handlers for popup menu actions
   $("#menu .close").on("click", function() {
      hideMenu();
   });
   $("#collapse").on("click", function() {
      var d = $("#menu").data("target");
      var node = d3.select("#circle-" + d.id);
      node.classed("collapsed", true);
      d.collapsedChildren = d.children;
      d.children = null;
      hideMenuFacets(d);
//      node.attr("r", nodeSize(d));
      updateVisualization(gNodes);
      $("#collapse").hide();
      $("#expand").show();
   });
   $("#expand").on("click", function() {
      var d = $("#menu").data("target");
      var node = d3.select("#circle-" + d.id);
      node.classed("collapsed", false);
      d.children = d.collapsedChildren;
      d.collapsedChildren = null;
      if (isLeaf(d)) {
         showMenuFacets(d);
      }
//      node.attr("r", nodeSize(d));
      updateVisualization(gNodes);
      $("#expand").hide();
      $("#collapse").show();
      $("#full-results").hide();
   });
   $("#unpin").on("click", function() {
      var d = $("#menu").data("target");
      d.fixed = false;
      d3.select("#circle-" + d.id).classed("fixed", false); // don't move circle to back, only line
      d3.select("#link-" + d.id).classed("fixed", false); //.moveToBack();
      $("#unpin").hide();
      $("#pin").show();
   });
   $("#pin").on("click", function() {
      var d = $("#menu").data("target");
      d.fixed = true;
      d3.select("#circle-" + d.id).classed("fixed", true).moveParentToFront();
      d3.select("#link-" + d.id).classed("fixed", true); //.moveToFront();
      $("#unpin").show();
      $("#pin").hide();
   });
   $("#trace").on("click", function() {
      var d = $("#menu").data("target");
      while (d) {
         d.traced = true;
         d3.select("#circle-" + d.id).classed("trace", true).moveParentToFront();
         var link = d3.select("#link-" + d.id).classed("trace", true); //.moveToFront();
         var ld = link.data();
         if (typeof ld[0] != "undefined") {
            d = ld[0].source;
            if (d.type == "root") {
               d = null;
            }
         } else {
            d = null;
         }
      }
      $("#untrace").show();
      $("#trace").hide();

   });
   $("#untrace").on("click", function() {
      var d = $("#menu").data("target");
      while (d) {
         d.traced = false;
         d3.select("#circle-" + d.id).classed("trace", false);
         var link = d3.select("#link-" + d.id).classed("trace", false);
         d = null;
         var ld = link.data();
         if (typeof ld[0] != "undefined") {
            d = ld[0].source;
            if (d.type == "root") {
               d = null;
            }
         } else {
            d = null;
         }
      }
      $("#trace").show();
      $("#untrace").hide();
   });
   $("#full-results").on("click", function() {
      $("#full-results").hide();
      $("#hide-full-results").show();
      var d = $("#menu").data("target");
      hideMenuFacets(d);
      d.fixed = true;
      d3.select("#circle-" + d.id).classed("fixed", true).moveParentToFront();
      d3.select("#link-" + d.id).classed("fixed", true); //moveToFront();
      getFullResults(d);
   });
   $("#hide-full-results").on("click", function() {
      $("#hide-full-results").hide();
      $("#full-results").show();
      var d = $("#menu").data("target");
      showMenuFacets(d);
      clearFullResults(d);
   });

   /**
    * Facet expansion
    */
   $("#archive").on("click", function() {
      var active =  $(this).find("input[type='checkbox']").prop('checked');
      $("#menu").find("input[type='checkbox']").prop('checked', false);
      var d = $("#menu").data("target");
      if (active === false) {
         d.fixed = true;
         d3.select("#circle-" + d.id).classed("fixed", true).moveParentToFront();
         d3.select("#link-" + d.id).classed("fixed", true);
         getFacetDetail(d, "archive");
         $(this).find("input[type='checkbox']").prop('checked', true);
         $("#collapse").show();
         $("#full-results").hide();
      } else {
         clearFacets(d);
         $(this).find("input[type='checkbox']").prop('checked', false);
         $("#full-results").show();
      }
   });
   $("#genre").on("click", function() {
      var active =  $(this).find("input[type='checkbox']").prop('checked');
      $("#menu").find("input[type='checkbox']").prop('checked', false);
      var d = $("#menu").data("target");
      if (active === false) {
         d.fixed = true;
         d3.select("#circle-" + d.id).classed("fixed", true).moveParentToFront();
         d3.select("#link-" + d.id).classed("fixed", true);
         getFacetDetail(d, "genre");
         $(this).find("input[type='checkbox']").prop('checked', true);
         $("#collapse").show();
         $("#full-results").hide();
      } else {
         clearFacets(d);
         $(this).find("input[type='checkbox']").prop('checked', false);
         $("#full-results").show();
      }
   });
   $("#discipline").on("click", function() {
      var active =  $(this).find("input[type='checkbox']").prop('checked');
      $("#menu").find("input[type='checkbox']").prop('checked', false);
      var d = $("#menu").data("target");
      if (active === false) {
         d.fixed = true;
         d3.select("#circle-" + d.id).classed("fixed", true).moveParentToFront();
         d3.select("#link-" + d.id).classed("fixed", true); //.moveToFront();
         getFacetDetail(d, "discipline");
         $(this).find("input[type='checkbox']").prop('checked', true);
         $("#collapse").show();
         $("#full-results").hide();
      } else {
         clearFacets(d);
         $(this).find("input[type='checkbox']").prop('checked', false);
         d3.select("#link-" + d.id).classed("fixed", false);// .moveToBack()
         $("#full-results").show();
      }
   });
   $("#doc_type").on("click", function() {
      var active =  $(this).find("input[type='checkbox']").prop('checked');
      $("#menu").find("input[type='checkbox']").prop('checked', false);
      var d = $("#menu").data("target");
      if (active === false) {
         d.fixed = true;
         d3.select("#circle-" + d.id).classed("fixed", true).moveParentToFront();
         d3.select("#link-" + d.id).classed("fixed", true); //moveToFront();
         getFacetDetail(d, "doc_type");
         $(this).find("input[type='checkbox']").prop('checked', true);
         $("#collapse").show();
         $("#full-results").hide();
      } else {
         clearFacets(d);
         $(this).find("input[type='checkbox']").prop('checked', false);
         $("#full-results").show();
      }
   });

   // Pan/Zoom behavior
   zoom = d3.behavior.zoom().on("zoom", function() {
      vis.attr("transform","translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")");
   });

   // Initialize D3 visualization
   var tt = $("#main-content").offset().top;

//   window.onresize = function() {//Dynamically resize the svg to fit the window
//      var svg = $("svg");
//      var width=svg.width();
//      var height=svg.height();
////      svg.attr("viewBox", tt+" 0 "+width+" "+height)
//   }
//
   d3.select('#tab-decade').classed("active", true);
   d3.select('#timeline-decade').call(d3.slider().value([1400, 1409]).axis(true).min(400).max(2100).step(10).animate(false).fixedRange(true)
         .on("slide", function(evt, value) {
            var which_decade = value[0];
            recalcSizeForDecade(gNodes, which_decade);
         })
   );
   d3.select('#tab-decade').classed("active", false);
   d3.select('#tab-quarter-century').classed("active", true);
   d3.select('#timeline-quarter-century').call(d3.slider().value([1400, 1424]).axis(true).min(400).max(2100).step(25).animate(false).fixedRange(true)
         .on("slide", function(evt, value) {
            var which_quarter_century = value[0];
            recalcSizeForQuarterCentury(gNodes, which_quarter_century);
         })
   );
   d3.select('#tab-quarter-century').classed("active", false);
   d3.select('#tab-half-century').classed("active", true);
   d3.select('#timeline-half-century').call(d3.slider().value([1400, 1449]).axis(true).min(400).max(2100).step(50).animate(false).fixedRange(true)
         .on("slide", function(evt, value) {
            var which_half_century = value[0];
            recalcSizeForHalfCentury(gNodes, which_half_century);
         })
   );
   d3.select('#tab-half-century').classed("active", false);
   d3.select('#tab-century').classed("active", true);
   d3.select('#timeline-century').call(d3.slider().value([1400, 1499]).axis(true).min(400).max(2100).step(100).animate(false).fixedRange(true)
         .on("slide", function(evt, value) {
            var which_century = value[0];
            recalcSizeForCentury(gNodes, which_century);
         })
   );
   d3.select('#tab-century').classed("active", false);
   d3.select('#tab-first-pub').classed("active", true);
   d3.select('#timeline-first-pub').call(d3.slider().value([400, 2100]).axis(true).min(400).max(2100).step(1).animate(false)
         .on("slide", function(evt, value) {
            var start_year = value[0];
            var end_year = value[1];
            recalcSizeForFirstPubYears(gNodes, start_year, end_year);
         })
   );
   hideTimeline();
   var force = d3.layout.force().size([width, height])
   	  .linkDistance(calcLinkDistance)
        .linkStrength(0.75)
   	  .charge(calcCharge)
//      .chargeDistance(1000)
      // following are default values
//      .friction(0.9)
      .gravity(0.2)// makes each node cling more tightly to it's parent verse the default of 0.1
//      .theta(0.8)
//      .alpha(0.1)
      // end default values
   	  .on("tick", tick);
   vis = d3.select("#main-content")
      .append("svg:svg")
         .attr("width", "100%")
         .attr("height", "100%")
//         .attr("viewBox", tt+" 0 "+width+" "+height)
      .append('svg:g').attr("id", "transform-group")
      .call(zoom)
      .append('svg:g');   // without this extra group, pan is jittery

   // setup gradients for nodes
   var defs = vis.append("defs");

// create filter with id #drop-shadow
// height=130% so that the shadow is not clipped
   var dsfilter = defs.append("filter")
      .attr("id", "drop-shadow")
      .attr("height", "200%")
      .attr("width", "200%");
// SourceAlpha refers to opacity of graphic that this filter will be applied to
// convolve that with a Gaussian with standard deviation 3 and store result
// in blur
   dsfilter.append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", 2)
      .attr("result", "blur");
// translate output of Gaussian blur to the right and downwards with 2px
// store result in offsetBlur
   dsfilter.append("feOffset")
      .attr("in", "blur")
      .attr("dx", 2)
      .attr("dy", 2)
      .attr("result", "offsetBlur");
// overlay original SourceGraphic over translated blurred opacity by using
// feMerge filter. Order of specifying inputs is important!
   var feMerge = dsfilter.append("feMerge");
   feMerge.append("feMergeNode")
      .attr("in", "offsetBlur")
   feMerge.append("feMergeNode")
      .attr("in", "SourceGraphic");

   var gradientInfo = [
      {"id":"gradient-arc-root-normal",     "color":"#686868", "highlight":"#a2a2a2"}, // grey
      {"id":"gradient-arc-root-selected",   "color":"#a2a2a2", "highlight":"#f9f9f9"},
      {"id":"gradient-resource-parent",    "color":"#132945", "highlight":"#1166AA"},
      {"id":"gradient-resource-parent-selected",  "color":"#1166AA", "highlight":"#f0f9e8"},
      {"id":"gradient-resource-normal",    "color":"#0868ac", "highlight":"#43a2ca"}, // blues: #f0f9e8, #bae4bc, #7bccc4, #43a2ca, #0868ac
      {"id":"gradient-resource-collapsed", "color":"#bae4bc", "highlight":"#0868ac"},
      {"id":"gradient-resource-fixed",     "color":"#0868ac", "highlight":"#7bccc4"},
      {"id":"gradient-resource-selected",  "color":"#43a2ca", "highlight":"#f0f9e8"},
      {"id":"gradient-genre-normal",     "color":"#006d2c", "highlight":"#2ca25f"},  // greens: #edf8fb, #b2e2e2, #66c2a4, #2ca25f, #006d2c
      {"id":"gradient-genre-collapsed",  "color":"#b2e2e2", "highlight":"#006d2c"},
      {"id":"gradient-genre-fixed",      "color":"#006d2c", "highlight":"#66c2a4"},
      {"id":"gradient-genre-selected",   "color":"#2ca25f", "highlight":"#edf8fb"},
      {"id":"gradient-discipline-normal",   "color":"#b30000", "highlight":"#e34a33"}, // reds: #fef0d9, #fdcc8a, #fc8d59, #e34a33, #b30000
      {"id":"gradient-discipline-collapsed","color":"#fdcc8a", "highlight":"#b30000"},
      {"id":"gradient-discipline-fixed",    "color":"#b30000", "highlight":"#fc8d59"},
      {"id":"gradient-discipline-selected", "color":"#e34a33", "highlight":"#fef0d9"},
      {"id":"gradient-format-normal",    "color":"#810f7c", "highlight":"#8856a7"}, // purples: #edf8fb, #b3cde3, #8c96c6, #8856a7, #810f7c
      {"id":"gradient-format-collapsed", "color":"#b3cde3", "highlight":"#810f7c"},
      {"id":"gradient-format-fixed",     "color":"#810f7c", "highlight":"#8c96c6"},
      {"id":"gradient-format-selected",  "color":"#8856a7", "highlight":"#edf8fb"}
   ];
   for (var idx in gradientInfo) {
      var info = gradientInfo[idx];
      var gradient = vis.append("svg:defs")
         .append("svg:linearGradient")
         .attr("id", info["id"])
         .attr("x1", "0%")
         .attr("y1", "0%")
         .attr("x2", "100%")
         .attr("y2", "100%")
         .attr("spreadMethod", "pad");

      gradient.append("svg:stop")
         .attr("offset", "15%")
         .attr("stop-color", info["highlight"])
         .attr("stop-opacity", 1);

      gradient.append("svg:stop")
         .attr("offset", "100%")
         .attr("stop-color", info["color"])
         .attr("stop-opacity", 1);
   }


   // add a fullscreen block as the background for the visualization
   // this catches mouse events that are not on the circles and lets the
   // whole thing be panned / zoomed
   pzRect = vis.append('svg:rect').attr('width', width*3).attr('height', height*3).attr('fill','#444444').attr("x", -1*width).attr("y", -1*height);
   pzRect.on("click", function(e) {
      d3.select(".menu").classed('menu', false);
      hidePopupMenu();
   });

   // hide until data is received
   //$("svg").hide();

   // Node drag behavior
   function onDragStart(d) {
      dragStarted = true;
      if (tipShowTimer !== -1) {
         clearTimeout(tipShowTimer);
         tipShowTimer = -1;
      }
      d3.event.sourceEvent.stopPropagation();
   }
   function onDrag(d) {
      if (dragStarted) {
         domNode = this;
         initDrag(d, domNode);
      }
   }
   function initDrag(d, domNode) {
      dragging = true;
      dragStarted = false;
      d3.select("#circle-"+d.id).classed("fixed", d.fixed = true);
   }
   var drag = force.drag().on("dragstart", onDragStart)
      .on("drag", onDrag)
      .on("dragend", function() {dragging = false;});

   // request the initial set of data; the archives
   d3.json("/archives", function(json) {
      gData = json;
      gNodes = flatten(gData);
      updateVisualization(gNodes);
   });

   /**
    * Redraw the d3 graph based on JSON data
    */
   var link = vis.selectAll(".link");    // all of the connecting lines
   var node = vis.selectAll(".node");    // all of the circles


   // **************************************************************************
   // updateVisualization
   // **************************************************************************

   function updateVisualization(nodes) {

      var links = d3.layout.tree().links(nodes);

      // Update the links
      link = link.data(links, function(d) {
         d.target.link = d.target.id;
         return d.target.id;
      });
      link.exit().remove();

      // Enter any new links
      link.enter().insert("line", ".node").attr("class", "link").attr("x1", function(d) {
         return d.source.x;
      }).attr("y1", function(d) {
         return d.source.y;
      }).attr("x2", function(d) {
         return d.target.x;
      }).attr("y2", function(d) {
         return d.target.y;
      }).attr("id", function(d) {
         return "link-"+d.target.id;
      });

      // Update the nodes
      node = node.data(nodes, function(d) {
         return d.id;
      });
      node.exit().remove();

      // Enter any new nodes; create a draggable group that will contain the circle and text
      var circles = node.enter()
         .append("svg:g")
            .attr("class", "node").call(drag);

      // add the circle to the group
      circles.append("svg:circle")
            .on("click", click)
//            .on("mouseenter", onMouseOver)
//            .on("mouseleave", onMouseLeave)
            .classed("fixed", isFixed)
            .classed("leaf", isLeaf)
            .classed("resource", function(d) { return (d.facet === "archive") || (d.type === "archive");} )
            .classed("genre", function(d) { return (d.facet === "genre") || (d.type === "genre");} )
            .classed("discipline", function(d) { return (d.facet === "discipline") || (d.type === "discipline");} )
            .classed("format", function(d) { return (d.facet === "doc_type") || (d.type === "format");} )
            .classed("no-data", isNoData)
            .classed("parent", isParent)
            .attr("id", function(d) {
               return "circle-"+d.id;
            })
            .attr("r", nodeSize);

      // add the text to the group. NOTE: using classed stuff doesn't
      // work here for some reason. Have to directly apply style in.
      circles.append("svg:text")
            .text(function(d) {if (d.handle) return d.handle; else return d.name;})
            .attr("text-anchor", "middle")
            .style("pointer-events", "none")
            .style("font-size", "0.55em")
            .style("stroke-width", "0px")
//            .style("fill", function(d) {
//               if (isNoData(d)) {
//                  return "rgba(255,255,255,0.5)";
//               }
//               return "white";
//            });

      // poly definition for document stack
      poly = [{"x":0.0, "y":0.0},
         {"x":14.0,"y":0.0},
         {"x":14.0,"y":4.0},
         {"x":18.0,"y":4.0},
         {"x":14.0,"y":0.0},
         {"x":18.0,"y":4.0},
         {"x":18.0,"y":25.0},
         {"x":0.0,"y":25.0},  // stop here for single document

         {"x":0.0,"y":0.0},
         {"x":0.0,"y":25.0},
         {"x":4.0,"y":25.0},
         {"x":4.0,"y":28.0},
         {"x":22.0,"y":28.0},
         {"x":22.0,"y":8.0},
         {"x":22.0,"y":8.0},
         {"x":18.0,"y":4.0},
         {"x":18.0,"y":25.0},
         {"x":0.0,"y":25.0}
      ];

//      var volumes = node.enter()
//         .append("svg:g")
//         .attr("class", "volume").call(drag);
//
//      volumes.append
//         .data([poly])
//         .enter().append("polygon")
//         .attr("points",function(d) {
//            return d.map(function(d) { return [d.x, d.y].join(","); }).join(" ");})
//         .attr("stroke","black")
//         .attr("fill", "yellow")
//         .attr("stroke-width",1);

      // visualization is laid out. now fade out the wait and fade in viz
      $("#wait").hide();
      $("svg").fadeIn();

      // restart force layout
      force.nodes(nodes).links(links).start();
   }

   function isLeaf(d) {
      return (d.type=="archive" || d.type == "genre" || d.type == "discipline" || d.type == "format" || d.type==="subfacet");
   }
   function isNoData(d) {
      return (isLeaf(d) && !d.size);
   }
   function isParent(d) {
      return (d.collapsedChildren || d.children );
   }

   function tick() {
      link.attr("x1", function(d) {
         return d.source.x;
      }).attr("y1", function(d) {
         return d.source.y;
      }).attr("x2", function(d) {
         return d.target.x;
      }).attr("y2", function(d) {
         return d.target.y;
      });

      node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")";});
   }

   function isFixed(d) {
      return d.fixed;
   }
   function calcLinkDistance(d) {
      if (d.target.type == "group") {
         if (d.source.type == "root") {
            return 600;  // root node has furthest links to children
         } else {
            return 300;  // intermediate node have longer links
         }
      } else {
         return 60;  // leaf nodes are close to parent
      }
   }

   function commaSeparateNumber(val) {
      if ( val ) {
         while (/(\d+)(\d{3})/.test(val.toString())) {
            val = val.toString().replace(/(\d+)(\d{3})/, '$1' + ',' + '$2');
         }
      }
      return val;
   }
   function calcCharge(d) {
      if (isNaN(d.size)) {
         d.size = 0;
      }
      var n = -45 * fastNodeSize(d.size);
      console.log(d.name + " ("+ d.size+") => "+n);
      return n;
   }


   function showMenuFacets(d) {
      // reset any highlights, and figure out which items
      // to show and which should be highlighted. Loop over the facets
      $("#menu").find("input[type='checkbox']").prop('checked', false);
      var facets = ["doc_type", "discipline", "genre", "archive"];
      $.each(facets, function(idx, val) {
         // If this node has an ancestor of the facet type, do NOT show the checkbox
         if (hasAncestorFacet(d, val) === false) {
            $("#" + val).show();
            if (d.choice === val) {
               $("#" + val).find("input[type='checkbox']").prop('checked', true);
            }
         }
      });
      $("#menu hr").show();
   }

   function hideMenuFacets(d) {
      $("#genre").hide();
      $("#discipline").hide();
      $("#doc_type").hide();
      $("#archive").hide();
   }

   function showPopupMenu(d) {
      function initMenu(d) {
         var collapsed = false;
         $("#expand").hide();
         $("#collapse").hide();
         if (!d.collapsedChildren && d.children && d.children.length > 0 && d.type !== "root") {
            $("#collapse").show();
            $("#full-results").hide();
         } else if (d.collapsedChildren) {
            $("#expand").show();
            $("#full-results").hide();
            collapsed = true;
         } else if (d.type === "root" || d.size === 0) {
            $("#full-results").hide();
         } else {
            $("#full-results").show();
         }
         $("#menu").data("target", d);
         if (d.results && d.results.length > 0) {
            $("#hide-full-results").show();
         } else {
            $("#hide-full-results").hide();
         }
         $("#unpin").show();
         $("#pin").hide();
         if (!d.fixed) {
            $("#unpin").hide();
            $("#pin").show();
         }
         if (d.traced) {
            $("#trace").hide();
            $("#untrace").show();
         } else {
            if (d.type === "root") {
               $("#trace").hide();
            } else {
               $("#trace").show();
            }
            $("#untrace").hide();
         }
         hideMenuFacets(d);

   //      $("#menu")
   //         .on("mouseenter", onMouseOverMenu)
   //         .on("mouseleave", onMouseLeaveMenu);

         // can this type of node have facet menu items?
         if (!collapsed && d.size && isLeaf(d)) {
             showMenuFacets(d);
         } else {
            $("#menu hr").hide();
         }
      }

      // clear the highlight on prior selection
      var oldD = $("#menu").data("target");
      if (oldD) {
         d3.select("#circle-" + oldD.id).classed("menu", false);
      }

      if (d.facet) {
         var f = d.facet;
         if ( f === "doc_type" ) {
            f = "format";
         }
         $("#title-label").text(f.charAt(0).toUpperCase() + f.slice(1) + ":");
      } else if (d.type == "genre" || d.type == "discipline" || d.type == "format") {
         $("#title-label").text(d.type.charAt(0).toUpperCase() + d.type.slice(1) + ":");
      } else {
         $("#title-label").text("Title:");
      }

      $("#info .title").text(d.name);
      $("#info .size").text(commaSeparateNumber(d.size));
      if ( $("#menu .pin").hasClass("pinned") === false) {
         $("#menu").css({
            "top" :  tipX + "px",
            "left" : tipY + "px"
         });
      }
      initMenu(d);
      menuNode = $("#menu");
      menuNode.show();
      selectedNodeId = d.id;
      if ( $("#menu .pin").hasClass("pinned") === false) {
         if (tipY + menuNode.outerHeight(true) >  $(window).height() ) {
            tipY = $(window).height() - menuNode.outerHeight(true) - 10;
         }
         if (tipX + menuNode.outerWidth(true) >  $(window).width() ) {
            tipX = $(window).width() - menuNode.outerWidth(true) - 10;
         }
         menuNode.css({
            "top" :  tipY + "px",
            "left" : tipX + "px"
         });
      }
      d3.select("#circle-" + d.id).classed("menu", true).moveParentToFront();
   }

   function hidePopupMenu(d) {
      if ( $("#menu .pin").hasClass("pinned") === false) {
         // clear the highlight on prior selection
         var oldD = $("#menu").data("target");
         if (oldD) {
            d3.select("#circle-" + oldD.id).classed("menu", false);
         }
         $("#menu").hide();
         menuNode = false;
      }
   }

   /**
    * Mouse over the popup menu; record that we are in the menu
    * @param {Object} d
    */

   function onMouseOverMenu(d) {
//      debug_log("onMouseOverMenu");
   }

   /**
    * Mouse exited the popup menu; record that we are no longer in the menu
    * @param {Object} d
    */

   function onMouseLeaveMenu(d) {
      if (activeNode) {
 //        debug_log("onMouseLeaveMenu");
         if (activeNode.ismouseover()) {
 //           debug_log("mouse over target, skipped hide");
            return;
         } else {
 //           debug_log("mouse not over target, hiding");
            hidePopupMenu(activeNodeD);
            activeNode = false;
            activeNodeD = false;
         }
      }
   }

   /**
    * Mouse over a node; trigger menu popup timer
    * @param {Object} d
    */

   function onMouseOver(d) {

      function isMenuVisible(d) {
         if ($("#menu").is(":visible") === false) {
            return false;
         }
         return ($("#menu").data("target") === d);
      }

      if (activeNodeD == d) {
         return;
      }
      activeNodeD = d;
      activeNode = $('circle-'+ activeNodeD.id);
 //     debug_log("onMouseOver");
      if (dragging === false && isMenuVisible(d) === false) {
         var pos = d3.mouse($("#main-content")[0]);
         tipX = pos[0];
         tipY = pos[1];
         if ($("#menu").is(":visible")) {
            // menu already visible - just update content
            showPopupMenu(d);
         } else {
            if (tipShowTimer === -1) {
               tipShowTimer = setTimeout(function() {
                  showPopupMenu(d);
               }, 400);
            }
         }
      }
   }

   function findNodeIndexByName(nodes, name) {
      for (var i in nodes) {
         var node = nodes[i];
         if (node.name === name) {
            return i;
         }
      }
      return false;
   }

   function updatePeriodData(nodes, json) {
      for (var i in json.children) {
         var entry = json.children[i];
         var hasPeriodData = (typeof entry.first_pub_year != "undefined");
         if (hasPeriodData) {
            var idx = findNodeIndexByName(gNodes, entry.name);
            if (idx !== false) {
               nodes[idx].first_pub_year = entry.first_pub_year;
               nodes[idx].decade = entry.decade;
               nodes[idx].quarter_century = entry.quarter_century;
               nodes[idx].half_century = entry.half_century;
               nodes[idx].century = entry.century;
               console.log("node " + entry.name + " (" + entry.size + ") COPIED");
            }
         }
         if (entry.children) {
            updatePeriodData(nodes, entry);
         }
      }
   }

   function sizeForFirstPubYears(years, start_year, end_year) {
      var total = 0;
      if (typeof end_year == 'undefined') {
         end_year = start_year;
      }
      for (var year in years) {
         if ((year >= start_year) && (year <= end_year)) {
//            console.log(year + " " + years[year]);
            total += years[year];
         }
      }
      return total
   }

   function sizeForDecade(decades, which_decade) {
      var total = 0;
      for (var decade in decades) {
         if (decade == which_decade) {
//            console.log(decade + " " + decades[decade]);
            total += decades[decade];
         }
      }
      return total
   }

   function sizeForQuarterCentury(quarter_centuries, which_quarter_century) {
      var total = 0;
      for (var quarter_century in quarter_centuries) {
         if (quarter_century == which_quarter_century) {
//            console.log(quarter_century + " " + quarter_centuries[quarter_century]);
            total += quarter_centuries[quarter_century];
         }
      }
      return total
   }

   function sizeForHalfCentury(half_centuries, which_half_century) {
      var total = 0;
      for (var half_century in half_centuries) {
         if (half_century == which_half_century) {
//            console.log(half_century + " " + half_centuries[half_century]);
            total += half_centuries[half_century];
         }
      }
      return total
   }

   function sizeForCentury(centuries, which_century) {
      var total = 0;
      for (var century in centuries) {
         if (century == which_century) {
//            console.log(century + " " + centuries[century]);
            total += centuries[century];
         }
      }
      return total
   }

   function fastNodeSize(count) {
      var sz = ""+ count;
      var extra = parseInt(sz.charAt(0),10);
      return sz.length*9+extra;
   }

   function recalcSizeForFirstPubYears(nodes, start_year, end_year) {
      for (var i = 0; i < nodes.length; i++) {
         var node = nodes[i];
         if (node.type != "group" && node.type != "root") {
            count = sizeForFirstPubYears(node.first_pub_year, start_year, end_year);
            node.size = count;
            if (node.id == selectedNodeId) {
//               console.log("found active Node "+node.id);
               $("#info .size").text(commaSeparateNumber(count));
               if (count > 0) {
                  $("#full-results").show();
               } else {
                  $("#full-results").hide();
               }
            }
            newSize = fastNodeSize(count);
//            console.log(count + " -> "+newSize);
            var circle = d3.select("#circle-" + node.id);
            circle.attr("r", newSize).classed("empty", count == 0);
            d3.select(circle.node().parentNode).select('text').classed("empty", count == 0);
         }
      }
   }

   function recalcSizeForDecade(nodes, which_decade) {
      for (var i = 0; i < nodes.length; i++) {
         var node = nodes[i];
         if (node.type != "group" && node.type != "root") {
            count = sizeForDecade(node.decade, which_decade);
            node.size = count;
            if (node.id == selectedNodeId) {
//               console.log("found active Node "+node.id);
               $("#info .size").text(commaSeparateNumber(count));
               if (count > 0) {
                  $("#full-results").show();
               } else {
                  $("#full-results").hide();
               }
            }
            newSize = fastNodeSize(count);
//            console.log(count + " -> "+newSize);
            var circle = d3.select("#circle-" + node.id);
            circle.attr("r", newSize).classed("empty", count == 0);
            d3.select(circle.node().parentNode).select('text').classed("empty", count == 0);
         }
      }
   }

   function recalcSizeForQuarterCentury(nodes, which_quarter_century) {
      for (var i = 0; i < nodes.length; i++) {
         var node = nodes[i];
         if (node.type != "group" && node.type != "root") {
            count = sizeForQuarterCentury(node.quarter_century, which_quarter_century);
            node.size = count;
            if (node.id == selectedNodeId) {
//               console.log("found active Node "+node.id);
               $("#info .size").text(commaSeparateNumber(count));
               if (count > 0) {
                  $("#full-results").show();
               } else {
                  $("#full-results").hide();
               }
            }
            newSize = fastNodeSize(count);
//            console.log(count + " -> "+newSize);
            var circle = d3.select("#circle-" + node.id);
            circle.attr("r", newSize).classed("empty", count == 0);
            d3.select(circle.node().parentNode).select('text').classed("empty", count == 0);
         }
      }
   }

   function recalcSizeForHalfCentury(nodes, which_half_century) {
      for (var i = 0; i < nodes.length; i++) {
         var node = nodes[i];
         if (node.type != "group" && node.type != "root") {
            count = sizeForHalfCentury(node.half_century, which_half_century);
            node.size = count;
            if (node.id == selectedNodeId) {
//               console.log("found active Node "+node.id);
               $("#info .size").text(commaSeparateNumber(count));
               if (count > 0) {
                  $("#full-results").show();
               } else {
                  $("#full-results").hide();
               }
            }
            newSize = fastNodeSize(count);
//            console.log(count + " -> "+newSize);
            var circle = d3.select("#circle-" + node.id);
            circle.attr("r", newSize).classed("empty", count == 0);
            d3.select(circle.node().parentNode).select('text').classed("empty", count == 0);
         }
      }
   }

   function recalcSizeForCentury(nodes, which_century) {
      for (var i = 0; i < nodes.length; i++) {
         var node = nodes[i];
         if (node.type != "group" && node.type != "root") {
            count = sizeForCentury(node.century, which_century);
            node.size = count;
            if (node.id == selectedNodeId) {
//               console.log("found active Node "+node.id);
               $("#info .size").text(commaSeparateNumber(count));
               if (count > 0) {
                  $("#full-results").show();
               } else {
                  $("#full-results").hide();
               }
            }
            newSize = fastNodeSize(count);
//            console.log(count + " -> "+newSize);
            var circle = d3.select("#circle-" + node.id);
            circle.attr("r", newSize).classed("empty", count == 0);
            d3.select(circle.node().parentNode).select('text').classed("empty", count == 0);
         }
      }
   }

   /**
    * Mouse left a node; kill menu popup timer
    * @param {Object} d
    */
   function onMouseLeave(d) {
      if (activeNodeD != d) {
         return;
      }
//      debug_log("onMouseLeave");
      if (tipShowTimer !== -1) {
         clearTimeout(tipShowTimer);
         tipShowTimer = -1;
      }
      if (menuNode) {
         if (menuNode.ismouseover(5)) {
//            debug_log("mouse over menu, skipped hide");
         } else {
 //           debug_log("mouse not over menu, hide");
            hidePopupMenu(d);
            activeNode = false;
            activeNodeD = false;
         }
      }
   }

   // Check if this node has an ancestor of the specified facet
   var hasAncestorFacet = function(d, facet) {
      if (d.type == facet) {
         return true;
      } else if (facet == "doc_type" && d.type == "format") {
         return true;
      }
      if (facet == "archive") {
         if (d.handle || d.archive_handle) {
            return true;
         }
      }
      if ( d.other_facets ) {
         var others = d.other_facets;
         if ( facet === "genre" && others.genre ) {
            return true;
         }
         if ( facet === "discipline" && others.discipline ) {
            return true;
         }
         if ( facet === "doc_type" && others.doc_type ) {
            return true;
         }
         if ( facet == "archive" && others.archive ) {
            return true;
         }
      }
      return (d.facet === facet);
   };

   /**
    * Node clicked. Pin it and pop the menu immediately
    * @param {Object} d
    */
   function click(d) {
      if (!d3.event.defaultPrevented) {
   //      d.fixed = true;
   //      d3.select("#circle-" + d.id).classed("fixed", true);
         d3.event.stopPropagation();
         var pos = d3.mouse($("#main-content")[0]);
         tipX = pos[0];
         tipY = pos[1];
         showPopupMenu(d);
      }
   }

   // Returns a list of all nodes under the root.
   function flatten(root) {
      var nodes = [], i = lastId;

      function recurse(node) {
         node.size = parseInt(node.size, 10);
         if (isNaN(node.size)) {
            node.size = 0;
         }
         if (node.children) {
            node.children.forEach(recurse);
         }
         if (!node.id) {
            node.id = ++i;
            lastId = node.id;
         }
         nodes.push(node);
      }
      recurse(root);
      return nodes;
   }

});