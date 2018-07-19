/*global $, d3, window */

//load json file with colors for bubbles
//   use fileName to ensure the browser does not cache the file and prevent custom colors from being displayed right away
var fileName = 'mycolors.json?nocache=' + (new Date()).getTime();

var allColors;
$.ajax({
  url: fileName,
  datatype: 'json',
  async: false,
  success: function(data) {
    allColors = data.colors;
    console.log(allColors);
  }
});

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
   var decSlide;
   var dragging = false;
   var dragStarted = false;
   var domNode = null;
   var activeNode = false;
   var activeNodeD = false;
   var menuEl = false;
   var gWidth = $(window).width();
   var gHeight = $(window).height();
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
   var gCurrAjaxQuery = false;

   // 0 is discipline, 1 is resource, 2 is genre, 3 is format

   var discipline1 = allColors[0].discipline1;
   var discipline2 = allColors[0].discipline2;
   var discipline3 = allColors[0].discipline3;
   var discipline4 = allColors[0].discipline4;
   var discipline5 = allColors[0].discipline5;

   var resource1 = allColors[1].resource1;
   var resource2 = allColors[1].resource2;
   var resource3 = allColors[1].resource3;
   var resource4 = allColors[1].resource4;
   var resource5 = allColors[1].resource5;

   var genre1 = allColors[2].genre1;
   var genre2 = allColors[2].genre2;
   var genre3 = allColors[2].genre3;
   var genre4 = allColors[2].genre4;
   var genre5 = allColors[2].genre5;

   var format1 = allColors[3].format1;
   var format2 = allColors[3].format2;
   var format3 = allColors[3].format3;
   var format4 = allColors[3].format4;
   var format5 = allColors[3].format5;

   //end David Color Work --------------------

   // sidebar paging
   $(".page-nav.prev").on("click", prevPageClicked );
   $(".page-nav.next").on("click", nextPageClicked );
   $("#toggle-sidebar").on("click", toggleSidebar );
   $(".page-nav.prev").hide();
   $(".page-nav.next").hide();

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
      var m = $("#menu");
      var d = m.data("target");
      if ( d ) {
         d3.select("#node-" + d.id).classed("menu", false);
      }
      m.hide();
   };

   /**
    * REMOVE results for a previously expanded node
    */
   var clearFacets = function(d) {
      d.children = null;
      d.choice = null;
      d.remainingStack = null;
      d.previousStack = null;
      gNodes = flatten(gData);
      updateVisualization(gNodes);
      var nodeEl = d3.select("#node-"+d.id);
      nodeEl.classed("leaf", true);
      nodeEl.classed("parent", false);
      var sz = nodeSize(d);
      nodeEl.attr("r",  sz);
      $("#collapse").hide();
      $("#expand").hide();
      $("#collapse-divider").hide();
      $("#next-results").hide();
      $("#prev-results").hide();
      $(".on-graph").removeClass("on-graph");
   };


   var updateSavedResultsList = function(d) {
      // recreate the savedResults list (wipe it out if it already exists)
      // and save anything from the current children that has been marked as fixed
      d.savedResults = [];
      for (var i = d.children.length - 1; i >= 0; i--) {
         var node = d.children[i];
         if (node.fixed && node.type === "object") {
            d.savedResults.push(node);
         }
      }
   };

   var nodeInYearRange = function(node) {
      if (node == null) return false;

      var year = null;
      if (gYearRangeStart && gYearRangeEnd) {
         if (gActiveTimeline == "first-pub") {
            // check against first pub year
            year = parseInt(Object.keys(node.first_pub_year)[0]);
            return (year >= gYearRangeStart && year <= gYearRangeEnd);
         } else {
            // check if any overlap between starting year range and end year range
            var years = node.years.value;
            if (! (years instanceof Array) ) {
               years = [ years ];
            }
            for (var i in years) {
               year = parseInt(years[i]);
               if (year >= gYearRangeStart && year <= gYearRangeEnd) {
                  // we found a published year inside our range, we are done
                  return true;
               }
            }
            // no published years inside our range
            return false;
         }
      } else {
         // timeline not active or sliders not yet moved
         return true;
      }
   };

   /**
    * Next page of results clicked
    */
   var getNextResultsPage = function(d) {
      var numPages = Math.floor((d.size + 4) / 5);
      if (d.page >= (numPages - 1) && d.page != 0 ) {
         return;
      }
      // get just the results, without the stack elements
      updateSavedResultsList(d);

      // if we've already gotten some results, save them in the prior results
      if (d.priorResults == null) {
         d.priorResults = d.currResults;
      } else {
         d.priorResults = d.priorResults.concat(d.currResults);
      }

      // If there are no results currently showing do not increase page
      // number. This would skip the first page of resuts. Note: this
      // only happens when results are visible and timeline is
      // changed. All pages are wiped, and all that is left is a stack.
      if ( d.currResults != null ) {
         d.page++;
      }
      /*if ( $("#sidebar").data("node") == d ) {
         var sidebarMaxPage = (d.listPage)*10+9;
         var vizMaxPage = d.page *5+4;
         if (vizMaxPage > sidebarMaxPage ) {
            nextPageClicked();
         }
      } */

      getSearchResultsPage(d, d.page, function(d, json) {
         alert("Unexpected Error! "+json);
      });
   };

   var getPrevResultsPage = function(d) {
      if (d.page <= 0) {
         return;
      }
      updateSavedResultsList(d);
      // get the last 5 results (matching by date range if sliders are in use) out of the prev results section
      var numFound = 0;
      d.currResults = [];
      for (var i = d.priorResults.length - 1; i >= 0; i--) {
         var node = d.priorResults.pop();
         if (nodeInYearRange(node)) {
            numFound++;
            if (node.fixed != true) {
               // ignore any fixed nodes from the current list since they should already be in the savedResults
               d.currResults.push(node);
            }
         }
         if (numFound >= 5) break;
      }
      d.page = Math.floor(d.priorResults.length / 5);
      var priorSummary = makeSummaryNode(d.priorResults, false);
      var summary = makeSummaryNode(d.currResults, true);
      var tmpSummary = subtractNodeYearCounts(d, summary);  // subtract year data in summary from year data in d
      var remainingSummary = subtractNodeYearCounts(tmpSummary, priorSummary);  // subtract year data in summary from year data in d
      makeRemainingResultsNode(d, remainingSummary);
      makePreviousResultsNode(d, priorSummary);
      var curr = d.currResults.slice(); // shallow array copy so we don't modify d.currResults
      if (d.savedResults) {
         // add in the saved results
         curr = curr.concat(d.savedResults);
      }
      if (d.previousStack) {
         curr = [ d.previousStack ].concat(curr);
      }
      if (d.remainingStack) {
         curr = curr.concat(d.remainingStack);
      }
      d.children = curr;
      gNodes = flatten(gData);
      updateVisualization(gNodes);
   };

   function getNodeScreenCoords(node) {
      var nodeEl = document.getElementById("node-"+node.id);
      if (!nodeEl) return { cx: 0, cy: 0};
      var ctm = nodeEl.getCTM();
      var mtrans = d3.transform(vis.attr("transform"));
      var mx = mtrans.translate[0];
      var my = mtrans.translate[1];
      var sx = mtrans.scale[0];
      var sy = mtrans.scale[1];
      var cx = (ctm.e - mx)/sx + nodeEl.getAttribute('cx')*sx;
      var cy = (ctm.f - my)/sy + nodeEl.getAttribute('cy')*sy;
      return { cx: cx, cy: cy };
   }

   var makePreviousResultsNode = function(d, summary) {
      if (d.page > 0) {
         var total = d.size;
         var previous = d.page * 5;
         var cx = 0;
         var cy = 0;
         var fixed = false;
         if (d.previousStack) {
            var pos = getNodeScreenCoords(d.previousStack);
            cx = pos.cx;
            cy = pos.cy;
            fixed = true;
         }
         d.previousStack = {
            "parentNode":d,
            "name":"Previous " + previous + " of " + total + "...",
            "type":"stack",
            "isPrev":true,
            "size":previous,
            "century": summary.century,
            "decade": summary.decade,
            "half_century": summary.half_century,
            "quarter_century": summary.quarter_century,
            "first_pub_year": summary.first_pub_year,
            "fixed": fixed,
            "x": cx,
            "y": cy
         };
      } else {
         d.previousStack =  null;
      }
   };

   var makeRemainingResultsNode = function(d, summary) {
      var numPages = Math.floor((d.size + 4) / 5);
      if (d.page < (numPages - 1) ) {
         var cx = 0;
         var cy = 0;
         var fixed = false;
         if (d.remainingStack) {
            var pos = getNodeScreenCoords(d.remainingStack);
            cx = pos.cx;
            cy = pos.cy;
            fixed = true;
         }
         var total = d.size;
         var remaining = total - ((d.page + 1) * 5);
         d.remainingStack = {
            "parentNode":d,
            "name":"Next " + remaining + " of " + total + "...",
            "type":"stack",
            "size":remaining,
            "century": summary.century,
            "decade": summary.decade,
            "half_century": summary.half_century,
            "quarter_century": summary.quarter_century,
            "first_pub_year": summary.first_pub_year,
            "fixed": fixed,
            "x": cx,
            "y": cy
         };
      } else {
         d.remainingStack = null;
      }
   };

   var getSearchResultsPage = function(d, page, onFail) {
      // build the query string
      var query = "/search?";
      var params = getFacetParams(d);
      if (page > 0) {
         params += "&pg=" + page;
      }

      // append the query/date stuff (true causes date param to be added)
      params = params + getSearchParams("&", true);

      showWaitPopup();
      gCurrAjaxQuery = d3.json(query+params, function(json) {
         gCurrAjaxQuery = false;
         if (json !== null && json.length > 0) {
            var nodeEl = d3.select("#node-"+d.id);
            nodeEl.classed("leaf", false);
            nodeEl.classed("parent", true);
            d.choice = "results";
            d.page = page;
            if (d.savedResults) {
               var cleanjson = [];
               // strip out any duplicates from saved list
               for (var j = 0; j < json.length; j++) {
                  var node = json[j];
                  for (var i = 0; i < d.savedResults.length; i++) {
                     savedNode = d.savedResults[i];
                     if (savedNode.uri === node.uri) {
                        console.log('ignoring duplicate node '+node.uri);
                        node = false;
                        break;
                     }
                  }   // add in the saved results
                  if (node !== false) {
                     console.log('including result node '+node.uri);
                     cleanjson.push(node);
                  }
               }
               json = cleanjson;
               d.currResults = json.slice(); // shallow array copy
               json = json.concat(d.savedResults);
            } else {
               d.currResults = json.slice(); // shallow array copy
            }
            var priorSummary = makeSummaryNode(d.priorResults, false);
            var summary = makeSummaryNode(json, true);
            var tmpSummary = subtractNodeYearCounts(d, summary);  // subtract year data in summary from year data in d
            var remainingSummary = subtractNodeYearCounts(tmpSummary, priorSummary);  // subtract year data in summary from year data in d
            makeRemainingResultsNode(d, remainingSummary);
            if (d.page > 0) {
               makePreviousResultsNode(d, priorSummary);
            }

            if (d.previousStack) {
               json = [ d.previousStack ].concat(json);
            }
            if (d.remainingStack) {
               json = json.concat(d.remainingStack);
            }

            /*if ( $("#sidebar").data("node") == d ) {
               highlightResults(d, json);
            }*/

            d.children = json;
            gNodes = flatten(gData);
            updateVisualization(gNodes);
         } else {
            onFail(d, json);
         }
         hideWaitPopup();
      });
   };

   /**
    * get results for a facet on the specified node
    */
   var getFullResults = function(d) {

      // if results have already been expanded for this node, remove them
      var childrenReset = false;
      if ( d.choice ) {
         d.children = null;
         d.choice = null;
         childrenReset = true;
      }

      $("#next-results").show(); // for full results expansion, we want next/prev results items present
      $("#prev-results").show();

      /*var page = 0;
      if ( $("#sidebar").data("node") == d ) {
         var listPage = d.listPage;
         page = listPage*2;
      }

      getSearchResultsPage(d, page, function(d) {
         if ( childrenReset === true ) {
            updateVisualization(gNodes);
         }
         $(".on-graph").removeClass("on-graph");
         var nodeEl = d3.select("#node-"+d.id);
         nodeEl.classed("leaf", true);
         nodeEl.classed("parent", false);
         alert("No results found!");
      });*/
      getSearchResultsPage(d, 0, function(d) {
         if ( childrenReset === true ) {
            updateVisualization(gNodes);
         }
         var nodeEl = d3.select("#node-"+d.id);
         nodeEl.classed("leaf", true);
         nodeEl.classed("parent", false);
         alert("No results found!");
      });
   };

   /**
    * get details for a facet on the specified node
    */
   var getFacetDetail = function(d, facetName) {
      showWaitPopup();
      $("#next-results").hide();  // for facet expansion, we never want next/prev results items present
      $("#prev-results").hide();

      // if facets have already been expanded for this node, remove them
	   var childrenReset = false;
	   if ( d.choice ) {
         d.children = null;
         d.choice = null;
         childrenReset = true;
      }

      // build the query string
      var query = "/facet?f="+facetName;
      var params = getFacetParams(d);

      // append the query/date stuff
      params = params + getSearchParams("&");

      var nodeEl = d3.select("#node-"+d.id);
      gCurrAjaxQuery = d3.json(query+params, function(json) {
         gCurrAjaxQuery = false;
         if ( json !== null && json.length > 0 ) {
            d.choice = facetName;
            nodeEl.classed("leaf", false);
            nodeEl.classed("parent", true);
            d.children = json;
            gNodes = flatten(gData);
            timelineFilter();
            updateVisualization(gNodes);
         } else {
            if ( childrenReset === true ) {
               updateVisualization(gNodes);
            }
            nodeEl.classed("leaf", true);
            nodeEl.classed("parent", false);
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

   /**
    * Filter based on timeline settings
    */
   var timelineFilter = function() {
      if (gActiveTimeline == "first-pub") {
         recalcSizeForFirstPubYears(gNodes, gYearRangeStart, gYearRangeEnd);
      } else if (gActiveTimeline == "decade") {
         recalcSizeForDecade(gNodes, gYearRangeStart, gYearRangeEnd);
      } else if (gActiveTimeline == "quarter-century") {
         recalcSizeForQuarterCentury(gNodes, gYearRangeStart, gYearRangeEnd);
      } else if (gActiveTimeline == "half-century") {
         recalcSizeForHalfCentury(gNodes, gYearRangeStart, gYearRangeEnd);
      } else if (gActiveTimeline == "century") {
         recalcSizeForCentury(gNodes, gYearRangeStart, gYearRangeEnd);
      }
   };

   /**
    * Filter the results with search terms
    */
   var filterData = function() {
      // grab the search terms (if any) and get them formatted
      filter.searchQuery = $("#query").val();
      if ( filter.searchQuery.length > 0) {
         filter.searchQuery = "q=%2b"+filter.searchQuery.replace(/\s/g, "%2b");
      }

      // filter the results
      showWaitPopup();
      if (gCurrAjaxQuery) {
         gCurrAjaxQuery.abort();
      }

      // NOTES: do not include date filters. All data is returned and filtered live by date.
      // see the slider code around line 1050. I think this was done to prevent constant requery
      // of the data as sliders are dragged
      gCurrAjaxQuery = d3.json("/search_"+rootMode+"?p=all"+getSearchParams("&"), function(json) {
         gCurrAjaxQuery = false;
         if ( !json ) {
            alert("Unable to perform filter");
         } else {
            gData = json;
            stripZeroLen(gData);
            gNodes = flatten(gData);
            timelineFilter();
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
      var pin = $(".pin");
      if (  pin.hasClass("pinned" ) ) {
         pin.removeClass("pinned" );
      }  else {
         pin.addClass("pinned" );
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

   var resetTimeline = function() {
      $("#show-timeline-button").hide();
      $("#loading-timeline").show();
      $('#help-lower').css("bottom", "36px");
      gYearRangeEnd = 400;
      gYearRangeStart = 2100;
   };
   var showTimelineReady = function() {
      $("#show-timeline-button").show();
      $("#loading-timeline").hide();
   };

   /**
    * Fully reset visualization
    */
   $("#reset").on("click", function() {
      window.location.reload();
   });

   $("#recenter").on("click", function() {
      hideMenu();
      recenter();
   });

   /**
    * Toggle timeline visibility
    */
   $("#show-timeline-button").on("click", function() {
      if ( $(this).text().indexOf("Show") > -1 ) {
         showTimeline();
      } else {
         hideTimeline();
      }
   });

   function hideTimeline() {
      $("footer").hide();
      $("#timeline-tabs").hide();
      $("#bigdiva-logo").removeClass("timeline-adjust");
      $("#footer-panel a#help").removeClass("timeline-adjust");
      $("#show-timeline-button").text("Show Timeline");
      $("#show-timeline-button").css("bottom", "6px");
      $('#help-lower').css("bottom", "37px");
      $(".tab-links .selected").removeClass("selected");
      $("#first-pub-block").addClass("selected");
   }

   function showTimeline() {
      $("footer").show();
      $("#timeline-tabs").show();
      $("#bigdiva-logo").addClass("timeline-adjust");
      $("#footer-panel a#help").addClass("timeline-adjust");
      $("#show-timeline-button").text("Hide Timeline");
      $("#show-timeline-button").css("bottom", "105px");
      $('#help-lower').css("bottom", "137px");
   }


   /**
    * switch to archive-based visualization
    */
   var switchRoot = function(newRoot) {
      if (gCurrAjaxQuery) {
         gCurrAjaxQuery.abort();
      }
      showWaitPopup();
      hideMenu();
      $("#query").val("");
      rootMode = newRoot;
      var selId = newRoot;
      if ( selId == "archives") {
         selId = "#resource-block";
      } else {
         selId = "#"+selId.substring(0, selId.length-1)+"-block";
      }

      gCurrAjaxQuery =  d3.json("/"+rootMode+"?p=all", function(json) {
         gData = json;
         gNodes = flatten(gData);
         updateVisualization(gNodes);
         gCurrAjaxQuery = false;
         updatePeriodData(gNodes, json);
         timelineFilter();
         hideWaitPopup();
         $("#key .selected").removeClass('selected');
         $(selId).addClass('selected');
      });
   }

   /**
    * switch to visualization root
    */
   $("#resource-block").on("click", function() {
      switchRoot("archives");
   });

   $("#genre-block").on("click", function() {
      switchRoot("genres");
   });

   $("#discipline-block").on("click", function() {
      switchRoot("disciplines");
   });

   $("#format-block").on("click", function() {
      switchRoot("formats");
   });

   // Handlers for popup menu actions
   $("#menu .close").on("click", function() {
      hideMenu();
   });
   $("#collapse").on("click", function() {
      var d = $("#menu").data("target");
      var node = d3.select("#node-" + d.id);
      node.classed("collapsed", true);
      hideMenuFacets(d);
      d.collapsedChildren = d.children;
      d.children = null;
      gNodes = flatten(gData);
      updateVisualization(gNodes);
      $("#collapse").hide();
      $("#expand").show();
      $("#collapse-divider").show();
   });
   $("#expand").on("click", function() {
      var d = $("#menu").data("target");
      var node = d3.select("#node-" + d.id);
      node.classed("collapsed", false);
      if (isLeaf(d)) {
         showMenuFacets(d);
      }
//      node.attr("r", nodeSize(d));
      d.children = d.collapsedChildren;
      d.collapsedChildren = null;
      gNodes = flatten(gData);
      updateVisualization(gNodes);
      $("#expand").hide();
      $("#collapse").show();
      $("#collapse-divider").show();
   });
   $("#unpin").on("click", function() {
      var d = $("#menu").data("target");
      d.fixed = false;
      d3.select("#node-" + d.id).classed("fixed", false); // don't move circle to back, only line
      d3.select("#link-" + d.id).classed("fixed", false); //.moveToBack();
      $("#unpin").hide();
      $("#pin").show();
   });
   $("#pin").on("click", function() {
      var d = $("#menu").data("target");
      d.fixed = true;
      d3.select("#node-" + d.id).classed("fixed", true).moveParentToFront();
      d3.select("#link-" + d.id).classed("fixed", true); //.moveToFront();
      $("#unpin").show();
      $("#pin").hide();
   });
   $("#trace").on("click", function() {
      var d = $("#menu").data("target");
      while (d) {
         d.traced = true;
         d3.select("#node-" + d.id).classed("trace", true).moveParentToFront();
         var linkEl = d3.select("#link-" + d.id).classed("trace", true); //.moveToFront();
         var ld = linkEl.data();
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
         d3.select("#node-" + d.id).classed("trace", false);
         var linkEl = d3.select("#link-" + d.id).classed("trace", false);
         d = null;
         var ld = linkEl.data();
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
   $("#next-results").on("click", function() {
      var d = $("#menu").data("target");
      getNextResultsPage(d);
   });
   $("#prev-results").on("click", function() {
      var d = $("#menu").data("target");
      getPrevResultsPage(d);
   });

   /**
    * Show facets triggered by change in the passed checkbox control
    */
   var showFacets = function(checkbox) {
      // always clear all facets on this node
      var parentNode = $("#menu").data("target");
      clearFacets(parentNode);

      // if checked, clear all previous checks and get the facets
      var facetType = $(checkbox).attr("id");
      if ( $(checkbox).is(':checked') === true ) {
         $("#menu input[type='checkbox']").each( function() {
            if ( $(this).attr("id") != facetType ) {
               $(this).prop("checked", false);
            }
         });

         parentNode.fixed = true;
         d3.select("#node-" + parentNode.id).classed("fixed", true).moveParentToFront();
         d3.select("#link-" + parentNode.id).classed("fixed", true);
         if ( $(checkbox).attr("id") == "full-results" ) {
            getFullResults(parentNode);
         } else {
            getFacetDetail(parentNode, facetType );
         }

         $("#collapse").show();
         $("#collapse-divider").show();
      }
   };

   $("#archive").on("click", function() {
      showFacets( this );
   });
   $("#genre").on("click", function() {
      showFacets( this );
   });

   $("#discipline").on("click", function() {
      showFacets( this );
   });
   $("#doc_type").on("click", function() {
      showFacets( this );
   });
   $("#full-results").on("click", function() {
      showFacets( this );
   });

   // Pan/Zoom behavior
   zoom = d3.behavior.zoom().on("zoom", function() {
      vis.attr("transform","translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")");
   });

   // Initialize D3 visualization
   var tt = $("#main-content").offset().top;

   /**
    * TIMELINE SLIDERS AND HANDLERS
    */
   d3.select('#tab-decade').classed("active", true);
   decSlide = d3.slider().value([1400, 1409]).axis(true).min(400).max(2100).step(10).animate(false).fixedRange(true)
      .on("slide", function(evt, value) {
         gActiveTimeline = "decade";
         gYearRangeStart = value[0];
         gYearRangeEnd = gYearRangeStart + 9;
         recalcSizeForDecade(gNodes, gYearRangeStart);
         $('#decade-block').data("range", gYearRangeStart+","+gYearRangeEnd);
      })
   d3.select('#timeline-decade').call(decSlide);
   $('#decade-block').data("range", "1400,1409");

   d3.select('#tab-decade').classed("active", false);
   d3.select('#tab-quarter-century').classed("active", true);
   d3.select('#timeline-quarter-century').call(d3.slider().value([1400, 1424]).axis(true).min(400).max(2100).step(25).animate(false).fixedRange(true)
         .on("slide", function(evt, value) {
            gActiveTimeline = "quarter-century";
            gYearRangeStart = value[0];
            gYearRangeEnd = gYearRangeStart + 24;
            recalcSizeForQuarterCentury(gNodes, gYearRangeStart);
            $('#quarter-century-block').data("range", gYearRangeStart+","+gYearRangeEnd);
         })
   );
   $('#quarter-century-block').data("range", "1400,1424");

   d3.select('#tab-quarter-century').classed("active", false);
   d3.select('#tab-half-century').classed("active", true);
   d3.select('#timeline-half-century').call(d3.slider().value([1400, 1449]).axis(true).min(400).max(2100).step(50).animate(false).fixedRange(true)
         .on("slide", function(evt, value) {
            gActiveTimeline = "half-century";
            gYearRangeStart = value[0];
            gYearRangeEnd = gYearRangeStart + 49;
            recalcSizeForHalfCentury(gNodes, gYearRangeStart);
            $('#half-century-block').data("range", gYearRangeStart+","+gYearRangeEnd);
         })
   );
   $('#half-century-block').data("range", "1400,1449");

   d3.select('#tab-half-century').classed("active", false);
   d3.select('#tab-century').classed("active", true);
   d3.select('#timeline-century').call(d3.slider().value([1400, 1499]).axis(true).min(400).max(2100).step(100).animate(false).fixedRange(true)
         .on("slide", function(evt, value) {
            gActiveTimeline = "century";
            gYearRangeStart = value[0];
            gYearRangeEnd = gYearRangeStart + 99;
            recalcSizeForCentury(gNodes, gYearRangeStart);
            $('#century-block').data("range", gYearRangeStart+","+gYearRangeEnd);
         })
   );
   $('#century-block').data("range", "1400,1499");

   d3.select('#tab-century').classed("active", false);
   d3.select('#tab-first-pub').classed("active", true);
   d3.select('#timeline-first-pub').call(d3.slider().value([400, 2100]).axis(true).min(400).max(2100).step(1).animate(false)
         .on("slide", function(evt, value) {
            gYearRangeStart = value[0];
            gYearRangeEnd = value[1];
            gActiveTimeline = "first-pub";
            $('#first-pub-block').data("range", value.join(","));
            recalcSizeForFirstPubYears(gNodes, gYearRangeStart, gYearRangeEnd);
         })
   );
   $('#first-pub-block').data("range", "400,2100");

   $(".timeline-tab").on("click", function(e) {
      var range = $(this).data("range");
      gYearRangeStart = parseInt(range.split(",")[0],10);
      gYearRangeEnd =  parseInt(range.split(",")[1],10);
      var id = $(this).attr("id");
      gActiveTimeline = id.replace("-block", "");

      if (gActiveTimeline == "first-pub") {
         recalcSizeForFirstPubYears(gNodes, gYearRangeStart, gYearRangeEnd);
      } else if (gActiveTimeline == "decade") {
         recalcSizeForDecade(gNodes, gYearRangeStart, gYearRangeEnd);
      } else if (gActiveTimeline == "quarter-century") {
         recalcSizeForQuarterCentury(gNodes, gYearRangeStart, gYearRangeEnd);
      } else if (gActiveTimeline == "half-century") {
         recalcSizeForHalfCentury(gNodes, gYearRangeStart, gYearRangeEnd);
      } else if (gActiveTimeline == "century") {
         recalcSizeForCentury(gNodes, gYearRangeStart, gYearRangeEnd);
      }
   });

   hideTimeline();
   $("#show-timeline-button").hide();

   var force = d3.layout.force().size([gWidth, gHeight])
      .linkDistance(calcLinkDistance)
      .linkStrength(calcLinkStrength)
   	.charge(calcCharge)
      .friction(0.8)
      .gravity(0.2)// makes each node cling more tightly to it's parent verse the default of 0.1
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
      .attr("in", "offsetBlur");
   feMerge.append("feMergeNode")
      .attr("in", "SourceGraphic");

   var gradientInfo = [
      {"id":"gradient-arc-root-normal",     "color":"#a2a2a2", "highlight":"#f9f9f9"}, // grey
      {"id":"gradient-arc-root-selected",   "color":"#a8a8a8", "highlight":"#ffffff"},
      {"id":"gradient-resource-parent",    "color":"#132945", "highlight":"#1166AA"},
      {"id":"gradient-resource-parent-selected",  "color":"#1166AA", "highlight":"#f0f9e8"},
      {"id":"gradient-resource-normal",    "color":resource5, "highlight":resource4}, // blues: #f0f9e8, #bae4bc, #7bccc4, #43a2ca, #0868ac
      {"id":"gradient-resource-collapsed", "color":resource2, "highlight":resource5},
      {"id":"gradient-resource-fixed",     "color":resource5, "highlight":resource3},
      {"id":"gradient-resource-selected",  "color":resource4, "highlight":resource1},
      {"id":"gradient-resource-disabled",     "color":"#686868", "highlight":"#a2a2a2"}, // grey
      {"id":"gradient-resource-disabled-selected",   "color":"#a2a2a2", "highlight":"#f9f9f9"},
      {"id":"gradient-genre-normal",     "color":genre5, "highlight":genre4},  // greens: #edf8fb, #b2e2e2, #66c2a4, #2ca25f, #006d2c
      {"id":"gradient-genre-collapsed",  "color":genre2, "highlight":genre5},
      {"id":"gradient-genre-fixed",      "color":genre5, "highlight":genre3},
      {"id":"gradient-genre-selected",   "color":genre4, "highlight":genre1},
      {"id":"gradient-discipline-normal",    "color":discipline5, "highlight":discipline4}, // NOW: yellows: #fff6db, #ffdd82, #ffce3d, #efb915, #e2aa00
      {"id":"gradient-discipline-collapsed", "color":discipline2, "highlight":discipline5},
      {"id":"gradient-discipline-fixed",     "color":discipline5, "highlight":discipline3},
      {"id":"gradient-discipline-selected",  "color":discipline4, "highlight":discipline1},
      {"id":"gradient-format-normal",    "color":format5, "highlight":format4}, // purples: #edf8fb, #b3cde3, #8c96c6, #8856a7, #810f7c
      {"id":"gradient-format-collapsed", "color":format2, "highlight":format5},
      {"id":"gradient-format-fixed",     "color":format5, "highlight":format3},
      {"id":"gradient-format-selected",  "color":format4, "highlight":format1}
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
   pzRect = vis.append('svg:rect').attr('width', gWidth*3).attr('height', gHeight*3).attr('fill','#444444').attr("x", -1*gWidth).attr("y", -1*gHeight);
   pzRect.on("click", function(e) {
      d3.select(".menu").classed('menu', false);
      hidePopupMenu();
   });

   /******************************************************
    * MOUSE BEHAVIORS
    ******************************************************/

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
         var m = $("#menu");
         var off = m.offset();

         m.offset({
            left : (off.left + dX),
            top : (off.top + dY)
         });

         dragMenu.x = e.pageX;
         dragMenu.y = e.pageY;
      }
   });

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
    * Node clicked. Pin it and pop the menu immediately
    * @param {Object} d
    */
   function nodeClick(d) {
      if (!d3.event.defaultPrevented) {
         d3.event.stopPropagation();
         if (d.type !== "stack") {
            var pos = d3.mouse($("#main-content")[0]);
            tipX = pos[0];
            tipY = pos[1];
            showPopupMenu(d);
            getSidebarResults(d);
         }
      }
   }

   function nodeMouseDown(d) {
      if (d.type === "stack") {
         if (d.size == 0 ) {
            return;
         }
         var targ = d.parentNode;
         if (d.isPrev) {
            getPrevResultsPage(targ);
         } else {
            getNextResultsPage(targ);
         }

         d3.event.preventDefault();
         d3.event.stopPropagation();
      }
   }

   function initDrag(d, domNode) {
      dragging = true;
      dragStarted = false;
      d3.select("#node-"+d.id).classed("fixed", d.fixed = true);
      if (d.remainingStack) {
         d.remainingStack.fixed = false;
      }
      if (d.previousStack) {
         d.previousStack.fixed = false;
      }
   }

   var drag = force.drag().on("dragstart", onDragStart)
      .on("drag", onDrag)
      .on("dragend", function() {dragging = false;});

   // preload the arc logo
   var arcLogoImage = new Image();
   arcLogoImage.src = gArcLogoImagePath;

   // then request the initial set of data; the archives
   gCurrAjaxQuery = d3.json("/archives", function (json) {
      gData = json;
      gNodes = flatten(gData);
      updateVisualization(gNodes);
      $("#loading-timeline").show();
      gCurrAjaxQuery = d3.json("/archives?p=all", function (json) {
         // update all the data
         updatePeriodData(gNodes, json);
         showTimelineReady();
         gCurrAjaxQuery = false;
      });
   });

   /**
    * Redraw the d3 graph based on JSON data
    */
   var linkElements = vis.selectAll(".link");    // all of the connecting lines
   var node = vis.selectAll(".node");    // all of the circles


   // **************************************************************************
   // updateVisualization
   // **************************************************************************

   function updateVisualization(nodes) {

      function adjustName(name) {
         return (name.length > 40) ? (name.substring(0, 40) + "...") : name;
      }
      function upcaseFirstChar(s) {
         if (s.charAt(0) == "_") {
            return " "+ s[1].toUpperCase();
         } else {
            return s[0].toUpperCase();
         }
      }
      function adjustHandle(name) {
         return name.replace(/(^[a-z])/, upcaseFirstChar).replace(/(_[a-z])/g, upcaseFirstChar).replace(/_/g,' ');
      }
      function addNames(selection, use_stroke) {
         selection.append("svg:text")
            .text(function (d) {
               if (d.short_name) return d.short_name;
               if (d.handle) return adjustHandle(d.handle); else return adjustName(d.name);
            })
            .attr("text-anchor", "middle")
            .attr("id", function (d) {
               return "caption-" + d.id;
            })
            .style("pointer-events", "none")
            .style("font-size", "0.55em")
            .style("font-weight", (use_stroke ? "bold":"normal"))
            .style("filter", (use_stroke ? "url(/#drop-shadow)":""))
            .style("fill", function (d) {
               if (isNoData(d)) {
                  return "rgba(255,255,255,0.5)";
               }
               return "white";
            });
      }

      var links = d3.layout.tree().links(nodes);

      // Update the links
      linkElements = linkElements.data(links, function(d) {
         d.target.linkElements = d.target.id;
         return d.target.id;
      });
      linkElements.exit().remove();

      // Enter any new links
      linkElements.enter().insert("line", ".node").attr("class", "link").attr("x1", function(d) {
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
      var new_nodes = node.enter()
         .append("svg:g")
            .attr("class", "node").call(drag);

      var objects = new_nodes.filter(function(d) { return d.type == "object"; });
      var stacks = new_nodes.filter(function(d) { return d.type == "stack"; });
      var root = new_nodes.filter(function(d) { return d.type == "root"; });
      var circles = new_nodes.filter(function(d) { return d.type != "object" && d.type != "stack" && d.type != "root"; });

      root.append("svg:circle")
         .on("click", nodeClick)
         .attr("id", function(d) { return "node-"+d.id; })
         .attr("r", nodeSize);
      root.append("svg:image")
         .on("click", nodeClick)
         .attr("xlink:href", gArcLogoImagePath)// this is defined in the application.html.erb
         .attr("x", "-25px")
         .attr("y", "-31px")
         .attr("width", "50px")
         .attr("height", "63px")

      objects.append("svg:polygon")
         .on("click", nodeClick)
         .classed("fixed", isFixed)
         .attr("id", function(d) { return "node-"+d.id; })
         .attr("points", "-9,-13 5,-13 5,-9 9,-9 5,-13 9,-9 9,12 -9,12")
         .attr("stroke","black")
         .attr("fill", "#ccc")
         .attr("stroke-width",1);

      stacks.append("svg:polygon")
         .on("mousedown", nodeMouseDown)
         .classed("fixed", isFixed)
         .attr("id", function(d) { return "node-"+d.id; })
         .attr("points", "-17,-21 1,-21 1,4 -17,4")
         .attr("stroke","black")
         .attr("fill", "#777")
         .attr("stroke-width",1);
      stacks.append("svg:polygon")
         .on("mousedown", nodeMouseDown)
         .classed("fixed", isFixed)
         .attr("id", function(d) { return "node-"+d.id; })
         .attr("points", "-13,-17 5,-17 5,8 -13,8")
         .attr("stroke","black")
         .attr("fill", "#777")
         .attr("stroke-width",1);
      stacks.append("svg:polygon")
         .on("mousedown", nodeMouseDown)
         .classed("fixed", isFixed)
         .attr("id", function(d) { return "node-"+d.id; })
         .attr("points", "-9,-13 5,-13 5,-9 9,-9 5,-13 9,-9 9,12 -9,12")
         .attr("stroke","black")
         .attr("fill", "#777")
         .attr("stroke-width",1);

      // add the circle to the group
      circles.append("svg:circle")
            .on("click", nodeClick)
//            .on("mousedown", nodeMouseDown)
            .classed("fixed", isFixed)
            .classed("leaf", isLeaf)
            .classed("disabled", isDisabled)
            .classed("resource", function(d) { return (d.facet === "archive") || (d.type === "archive");} )
            .classed("genre", function(d) { return (d.facet === "genre") || (d.type === "genre");} )
            .classed("discipline", function(d) { return (d.facet === "discipline") || (d.type === "discipline");} )
            .classed("format", function(d) { return (d.facet === "doc_type") || (d.type === "format");} )
            .classed("empty", isNoData)
            .classed("parent", isParent)
            .attr("id", function(d) { return "node-"+d.id; })
            .attr("r", nodeSize);

      // add the text to the group. NOTE: using classed stuff doesn't
      // work here for some reason. Have to directly apply style in.
      addNames(circles, false);
      addNames(objects, true);
      addNames(stacks, true);

      // visualization is laid out. now fade out the wait and fade in viz
      $("#wait").hide();
      $("svg").fadeIn();

      // restart force layout
      force.nodes(nodes).links(links).start();
   }

   function isLeaf(d) {
      return (d.type=="archive" || d.type == "genre" || d.type == "discipline" || d.type == "format" || d.type==="subfacet");
   }
   function isDisabled(d) {
      return ((d.type=="archive" || (d.type=="subfacet" && d.facet=="archive")) && d.enabled != true);
   }
   function isNoData(d) {
      return (isLeaf(d) && !d.size);
   }
   function isParent(d) {
      return (d.collapsedChildren || d.children );
   }
   function nodeClass(d) {
      return "node" + (d.type == "object" ? " object" : "") + (d.type == "stack" ? " stack": "");
   }

   function tick() {
      linkElements.attr("x1", function(d) {
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
         if (d.source.type == "root" || d.source.type == "group") {
            return 120;  // root node and group to group nodes has furthest links to children
         } else {
            return 90;  // intermediate node have longer links
         }
      } else if (d.target.type == "object") {
         return 40; // detailed results are close to leaf node
      } else {
         return 60;  // leaf nodes are close to parent
      }
   }
   function calcLinkStrength(d) {
      if (d.target.type == "group") {
         if (d.source.type == "root" || d.source.type == "group") {
            return 0.6;  // root node and group to group nodes has furthest links to children
         } else {
            return 0.75;  // intermediate node have longer links
         }
      } else if (d.target.type == "object" || d.target.type == "stack") {
         return 2.0;  // detailed results stay very tight to leaf node
      } else {
         return 0.8;  // leaf nodes are close to parent
      }
   }
   function calcCharge(d) {
      if (isNaN(d.size)) {
         d.size = 0;
      }
      var n = -45 * fastNodeSize(d.size);
      if (d.type === "object") {
         n = -2000; // detailed results really really don't want to overlap
      } else if (d.type === "stack") {
         n = -8000;
      }
//      console.log(d.name + " ("+ d.size+") => "+n);
      return n;
   }

   function commaSeparateNumber(val) {
      if ( val ) {
         while (/(\d+)(\d{3})/.test(val.toString())) {
            val = val.toString().replace(/(\d+)(\d{3})/, '$1' + ',' + '$2');
         }
      }
      return val;
   }


   function showMenuFacets(d) {
      // show all controls and clear the checkboxes
      $(".facet-control-ui").show();
      $("#full-results").show();
      $("#menu").find("input[type='checkbox']").prop('checked', false);

      var facets = ["doc_type", "discipline", "genre", "archive"];
      $.each(facets, function(idx, val) {
         // If this node has an ancestor of the facet type, HIDE the control UI
         if (hasAncestorFacet(d, val) === true) {
            $("#" + val).closest("li").hide();
         } else {
            if (d.choice === val) {
               $("#" + val).prop('checked', true);
            }
         }
      });

      if (d.choice == "results" ) {
         $("#full-results").prop('checked', true);
      }

      // show/hide results page based on checked status of individual results checkbox
      if ( $("#full-results").is(":checked") ) {
         $("#next-results").show();
         $("#prev-results").show();
      } else {
         $("#next-results").hide();
         $("#prev-results").hide();
      }
   }

   function hideMenuFacets(d) {
      $(".facet-control-ui").hide();
   }

   function showPopupMenu(d) {
      function initMenu(d) {
         var collapsed = false;
         $("#expand").hide();
         $("#collapse").hide();
         $("#collapse-divider").hide();
         if (!d.collapsedChildren && d.children && d.children.length > 0 && d.type !== "root") {
            $("#collapse").show();
            $("#collapse-divider").show();
         } else if (d.collapsedChildren) {
            $("#expand").show();
            $("#collapse-divider").show();
            collapsed = true;
         }
         $("#menu").data("target", d);
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

         if (d.type == "object") {
            if (gDebugMode) {
               $("tr#uri").show();
            } else {
               $("tr#uri").hide();
            }
            $("td#uri").text(d.uri);
            $("tr#link").show();
            var linkHTML = (d.url == null) ? "N/A" : "<a href=\""+ d.url + "\" target=\"_blank\">Click to View<\/a>";
            $("td#link").html(linkHTML);
            $("tr#publisher").show();
            $("td#publisher").text(d.publisher ? d.publisher.value : "");
            $("tr#author").show();
            $("td#author").text(d.author ? d.author.value : "");
            $("tr#fulltext").show();
            $("td#fulltext").text(d.has_full_text === "true" ? "Yes" : "No");
            $("tr#isocr").show();
            $("td#isocr").text(d.is_ocr === "true" ? "Yes" : "No");
            $("tr#isfreeculture").show();
            $("td#isfreeculture").text(d.freeculture === "true" ? "Yes" : "No");
            $("tr#pubdates").show();
            var yearStr = makePublishedString(d);
            $("td#pubdates").text(yearStr);
            $("tr#count").hide();
         } else {
            $("tr#uri").hide();
            $("tr#link").hide();
            $("tr#publisher").hide();
            $("tr#author").hide();
            $("tr#fulltext").hide();
            $("tr#isocr").hide();
            $("tr#pubdates").hide();
            $("tr#isfreeculture").hide();
            $("tr#count").show();
         }

         // can this type of node have facet menu items?
         if (!collapsed && d.size && isLeaf(d)
           && ((d.type != "archive" && d.facet != "archive") || d.enabled==true)) {
            showMenuFacets(d);
         } else {
            $("#facet-divider").hide();
         }
         if ((d.type == "archive" || d.facet == "archive") && d.enabled == false) {
            $("#not-subscriber-msg").show();
         } else {
            $("#not-subscriber-msg").hide();
         }
      }

      // clear the highlight on prior selection
      var oldD = $("#menu").data("target");
      if (oldD) {
         d3.select("#node-" + oldD.id).classed("menu", false);
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
      $("#info #size").text(commaSeparateNumber(d.size));
      if ( $("#menu .pin").hasClass("pinned") === false) {
         $("#menu").css({
            "top" :  tipX + "px",
            "left" : tipY + "px"
         });
      }
      initMenu(d);
      menuEl = $("#menu");
      menuEl.show();
      selectedNodeId = d.id;
      if ( $("#menu .pin").hasClass("pinned") === false) {
         if (tipY + menuEl.outerHeight(true) >  $(window).height() ) {
            tipY = $(window).height() - menuEl.outerHeight(true) - 10;
         }
         if (tipX + menuEl.outerWidth(true) >  $(window).width() ) {
            tipX = $(window).width() - menuEl.outerWidth(true) - 10;
         }
         menuEl.css({
            "top" :  tipY + "px",
            "left" : tipX + "px"
         });
      }
      d3.select("#node-" + d.id).classed("menu", true).moveParentToFront();
   }

   function hidePopupMenu(d) {
      if ( $("#menu .pin").hasClass("pinned") === false) {
         // clear the highlight on prior selection
         var oldD = $("#menu").data("target");
         if (oldD) {
            d3.select("#node-" + oldD.id).classed("menu", false);
         }
         $("#menu").hide();
         menuEl = false;
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
            }
         }
         if (entry.children) {
            updatePeriodData(nodes, entry);
         }
      }
   }

   // makes new deep copy of years list
   function sumYearList(years, addYears) {
      var resultYears = (years instanceof Object) ? JSON.parse(JSON.stringify(years)) : {};
      if (addYears instanceof Object) {
         for (var year in addYears) {
            if (addYears.hasOwnProperty(year)) {
               if (resultYears.hasOwnProperty(year)) {
                  resultYears[year] += addYears[year];
               } else {
                  resultYears[year] = addYears[year];
               }
            }
         }
      }
      return resultYears;
   }

   // makes new deep copy of years list
   function subYearList(years, subYears) {
      var resultYears = (years instanceof Object) ? JSON.parse(JSON.stringify(years)) : {};
      if (subYears instanceof Object) {
         for (var year in subYears) {
            if (subYears.hasOwnProperty(year)) {
               if (resultYears.hasOwnProperty(year)) {
                  resultYears[year] -= subYears[year];
               } else {
                  resultYears[year] = -subYears[year];
               }
            }
         }
      }
      return resultYears;
   }

   function makeSummaryNode(json, shouldCountFixedNodes) {
      var newNode = { "first_pub_year" : {}, "decade" : {}, "quarter_century": {}, "half_century": {}, "century": {}};
      if (json == null) return newNode;
      for (var i in json) {
         var entry = json[i];
         if (entry == null ) {
            console.log("huh");
         } else {
            if (shouldCountFixedNodes || (entry.fixed != true)) {
               var hasPeriodData = (typeof entry.first_pub_year != "undefined");
               if (hasPeriodData) {
                  newNode.first_pub_year = sumYearList(newNode.first_pub_year, entry.first_pub_year);
                  newNode.decade = sumYearList(newNode.decade, entry.decade);
                  newNode.quarter_century = sumYearList(newNode.quarter_century, entry.quarter_century);
                  newNode.half_century = sumYearList(newNode.half_century, entry.half_century);
                  newNode.century = sumYearList(newNode.century, entry.century);
               }
            }
         }
      }
      return newNode;
   }

   function subtractNodeYearCounts(node, subNode) {
      var newNode = { "first_pub_year" : {}, "decade" : {}, "quarter_century": {}, "half_century": {}, "century": {}};
      newNode.first_pub_year = subYearList(node.first_pub_year, subNode.first_pub_year);
      newNode.decade = subYearList(node.decade, subNode.decade);
      newNode.quarter_century = subYearList(node.quarter_century, subNode.quarter_century);
      newNode.half_century = subYearList(node.half_century, subNode.half_century);
      newNode.century = subYearList(node.century, subNode.century);
      return newNode;
   }

   function sizeForFirstPubYears(years, start_year, end_year) {
      var total = 0;
      if (typeof end_year == 'undefined') {
         end_year = start_year;
      }
      for (var year in years) {
         var intYear = parseInt(year, 10);
         if ((intYear >= start_year) && (intYear <= end_year)) {
            total += years[year];
         }
      }
      return total
   }

   function sizeForDecade(decades, which_decade) {
      var total = 0;
      for (var decade in decades) {
         var intDecade = parseInt(decade, 10);
         if (intDecade == which_decade) {
            total += decades[decade];
         }
      }
      return total
   }

   function sizeForQuarterCentury(quarter_centuries, which_quarter_century) {
      var total = 0;
      for (var quarter_century in quarter_centuries) {
         var intQtrCentury = parseInt(quarter_century, 10);
         if (intQtrCentury == which_quarter_century) {
            total += quarter_centuries[quarter_century];
         }
      }
      return total
   }

   function sizeForHalfCentury(half_centuries, which_half_century) {
      var total = 0;
      for (var half_century in half_centuries) {
         var intHalfCentury = parseInt(half_century, 10);
         if (intHalfCentury == which_half_century) {
            total += half_centuries[half_century];
         }
      }
      return total
   }

   function sizeForCentury(centuries, which_century) {
      var total = 0;
      for (var century in centuries) {
         var intCentury = parseInt(century, 10);
         if (intCentury == which_century) {
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

   /**
    * Timeline has changed; update the popup menu to reflect counts and
    * availble actions
    */
   function updateMenuForNode(node) {
      if (node.id == selectedNodeId) {
         $("#info td#size").text(commaSeparateNumber(node.size));
         if (node.type === "stack") {
            $("#info td.title").text(node.name);
         }
         if (node.size > 0) {
            $("#full-results").closest("li").show();
            $("#full-results").show();
         } else {
            $("#full-results").closest("li").hide();
            $("#full-results").hide();
         }
      }
   }

   /**
    * Recalculate size of node. Called when the timeline changes.
    * This hides leaves when they are no longer visible
    */
   function updateNodeSize(node, count) {
      node.size = count;
      var newSize = fastNodeSize(count);
      var circle = d3.select("#node-" + node.id);
      var caption = d3.select("#caption-" + node.id);

      // When count is 0 add empty class (mostly transparent fill)
      // and make the text semi-transparent
      circle.attr("r", newSize).classed("empty", count == 0);
      caption.style("fill", function(d) { return (count > 0) ? "white": "rgba(255,255,255,0.5)"; });

      // Special handling for nodes with individual results expanded
      // Clear out all of the pages showing, but leave one stack (next) with counts
      if (node.choice == "results") {

         // See if an update is needed - basically if there are child nodes
         // Special case is when there is one child node. If this node is a stack,
         // no update is needed - it is already the stack that shows First 5 of X...
         // If there is one non-stack node, this is a single result. It needs to
         // be replaced by a stack
         var stackCnt = 0;
         $.each(node.children, function(idx, val) {
            if ( val.type == "stack") {
               stackCnt++;
            }
         });
         var needsUpdate = (node.children.length > 1 ||node.children.length==1 && stackCnt==0);

         // clear out all prior data and reset to first page
         node.currResults = null;
         node.page = 0;
         node.savedResults = 0;
         node.remainingStack = null;
         node.previousStack = null;
         node.priorResults = null;

         if ( needsUpdate == true ) {
            var name = "First 5 of "+count+"...";
            if (count < 5 ) {
               name = "First "+count+" of "+count;
            }
            // Replace all children with a single Fist of stack and update viz
            var nextStack = {
               "parentNode":node,
               "name":name,
               "type":"stack",
               "size":count,
               "century": node.century,
               "decade": node.decade,
               "half_century": node.half_century,
               "quarter_century": node.quarter_century,
               "first_pub_year": node.first_pub_year,
               "fixed": false,
               "x": node.x,
               "y": node.y
            };
            node.children = [nextStack];
            gNodes = flatten(gData);
            updateVisualization(gNodes);
         }
      }

      // Since resuts are wiped when the timeline changes, this can only be a NEXT
      // stack. Further, since there are no current results, make this a special
      // next stack - get the first set of results
      if (node.type === "stack") {

         // Even more special; the count on this node assumes the first page is shown, so
         // we need to recalculate the total based upon the parent node counts
         if ( gActiveTimeline == "decade") {
            count = sizeForDecade(node.parentNode.decade, gYearRangeStart);
         } else if ( gActiveTimeline == "quarter-century") {
            count = sizeForQuarterCentury(node.parentNode.quarter_century, gYearRangeStart);
         } else if ( gActiveTimeline == "half-century") {
            count = sizeForHalfCentury(node.parentNode.half_century, gYearRangeStart);
         } else if ( gActiveTimeline == "century") {
            count = sizeForCentury(node.parentNode.century, gYearRangeStart)
         } else {
            count = sizeForFirstPubYears(node.parentNode.first_pub_year, gYearRangeStart, gYearRangeEnd);
         }

         if (count < 5 ) {
            node.name = "First "+count+" of "+count;
         } else {
            node.name = "First 5 of "+count+"...";
         }
         caption.text(node.name);
      }
   }

   function recalcSizeForFirstPubYears(nodes, start_year, end_year) {
      var count, i, node = 0;
      for (i = 0; i < nodes.length; i++) {
         node = nodes[i];
         if (node.type != "group" && node.type != "root") {
            count = sizeForFirstPubYears(node.first_pub_year, start_year, end_year);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
   }

   function recalcSizeForDecade(nodes, which_decade) {
      var count, i, node = 0;
      for (i = 0; i < nodes.length; i++) {
         node = nodes[i];
         if (node.type != "group" && node.type != "root") {
            count = sizeForDecade(node.decade, which_decade);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
   }

   function recalcSizeForQuarterCentury(nodes, which_quarter_century) {
      var count, i, node = 0;
      for (i = 0; i < nodes.length; i++) {
         node = nodes[i];
         if (node.type != "group" && node.type != "root") {
            count = sizeForQuarterCentury(node.quarter_century, which_quarter_century);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
   }

   function recalcSizeForHalfCentury(nodes, which_half_century) {
      var count, i, node = 0;
      for ( i = 0; i < nodes.length; i++) {
         node = nodes[i];
         if (node.type != "group" && node.type != "root") {
            count = sizeForHalfCentury(node.half_century, which_half_century);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
   }

   function recalcSizeForCentury(nodes, which_century) {
      var count, i, node = 0;
      for ( i = 0; i < nodes.length; i++) {
         node = nodes[i];
         if (node.type != "group" && node.type != "root") {
            count = sizeForCentury(node.century, which_century);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
   }

   function makePublishedString(node) {
      var lastYear = 0;
      var firstYear = null;
      var yearStr = "";
      if ((node.type === "object") && node.years && node.years.value) {
         var years = node.years.value;
         if (! (years instanceof Array) ) {
            years = [ years ];
         }
         for (var i in years) {
            var year = parseInt(years[i]);
            if (year != lastYear + 1) {
               // no longer in a sequence, add the old sequence if there was one)
               if (firstYear != null) {
                  if (lastYear > firstYear) {
                     // this is a sequence
                     yearStr += (firstYear + "-" + lastYear + ", ");
                  } else {
                     // this is a single year
                     yearStr += (firstYear + ", ");
                  }
                  lastYear = 0;
               }
               firstYear = year;
            }
            lastYear = year;
         }
         if (lastYear > firstYear) {
            yearStr += (firstYear + "-" + lastYear);
         } else if (firstYear && firstYear == lastYear) {
            yearStr += firstYear;
         } else {
            yearStr = yearStr.slice(0, -2);
         }
      } else {
         yearStr = "N/A";
      }
      return yearStr;
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
