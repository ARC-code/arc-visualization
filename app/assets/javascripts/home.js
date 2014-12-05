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
   var gYearRangeStart = 0;
   var gYearRangeEnd = 0;
   var gActiveTimeline = false;
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
         d3.select("#node-" + d.id).classed("menu", false);
      }
      $("#menu").hide();
   };

   /**
    * REMOVE results for a previously expanded node
    */
   var clearFullResults = function(d) {
      d.children = null;
      d.choice = null;
      gNodes = flatten(gData);
      updateVisualization(gNodes);
      var nodeEl = d3.select("#node-"+d.id);
      nodeEl.classed("leaf", true);
      nodeEl.classed("parent", false);
      var sz = nodeSize(d);
      nodeEl.attr("r",  sz);
   };

   /**
    * REMOVE details for a previously expanded facet
    */
   var clearFacets = function(d) {
      clearFullResults(d);
      d.other_facets = null;
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
   }

   var nodeInYearRange = function(node) {
      if (gYearRangeStart && gYearRangeEnd) {
         if (gActiveTimeline == "first-pub") {
            // check against first pub year
            var year = parseInt(Object.keys(node.first_pub_year)[0]);
            return (year >= gYearRangeStart && year <= gYearRangeEnd);
         } else {
            // check if any overlap between starting year range and end year range
            var years = node.years.value;
            if (! (years instanceof Array) ) {
               years = [ years ];
            }
            for (var i in years) {
               var year = parseInt(years[i]);
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
   }

   var getNextResultsPage = function(d) {
      var numPages = Math.floor((d.size + 4) / 5);
      if (d.page >= (numPages - 1)) {
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
      d.page++;
      getSearchResultsPage(d, d.page, function(d, json) {
         alert("Unexpected Error! "+json);
      });
   }

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
   }

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
   }

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
   }

   var getSearchResultsPage = function(d, page, onFail) {
      // build the query string
      var query = "/search?";
      var params = getFacetParams(d);
      if (page > 0) {
         params += "&pg=" + page;
      }

      // append the query/date stuff
      params = params + getSearchParams("&");

      showWaitPopup();
      d3.json(query+params, function(json) {
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
            makePreviousResultsNode(d, priorSummary);

            if (d.previousStack) {
               json = [ d.previousStack ].concat(json);
            }
            if (d.remainingStack) {
               json = json.concat(d.remainingStack);
            }
            d.children = json;
//      console.log(json);
            gNodes = flatten(gData);
            updateVisualization(gNodes);
         } else {
            onFail(d, json);
         }
         hideWaitPopup();
      });
   }

   /**
    * get results for a facet on the specified node
    */
   var getFullResults = function(d) {

      // if results have already been expanded for this node, remove them
      var childrenReset = false;
      if ( d.choice ) {
         d.children = null;
         d.choice = null;
//         d.other_facets = null;
         childrenReset = true;
      }

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

      var nodeEl = d3.select("#node-"+d.id);
      d3.json(query+params, function(json) {
         if ( json !== null && json.length > 0 ) {
            d.choice = facetName;
            nodeEl.classed("leaf", false);
            nodeEl.classed("parent", true);
            d.children = json;
            gNodes = flatten(gData);
//            nodeEl.attr("r", "15");
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

   function make4digitYear(year) {
      if (year > 999) return year;
      if (year > 99) return "0"+year;
      if (year > 9) return "00"+year;
      return "000"+year;
   }

   function getSearchParams( prepend ) {
      var params = [];
      if ( filter.searchQuery.length > 0 ) {
         params.push(filter.searchQuery);
      }
      if (gYearRangeStart && gYearRangeEnd) {
         params.push("y=%2b"+make4digitYear(gYearRangeStart)+"+TO+"+make4digitYear(gYearRangeEnd));
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

   var resetTimeline = function() {
      $("#show-timeline-button").hide();
      $("#loading-timeline").show();
      gYearRangeEnd = 0;
      gYearRangeStart = 0;
   }
   var showTimelineReady = function() {
      $("#show-timeline-button").show();
      $("#loading-timeline").hide();
   }
   /**
    * Fully reset visualization
    */
   $("#reset").on("click", function() {
      filter.searchQuery = "";
      filter.date = "";
      showWaitPopup();
      hideMenu();
      hideTimeline();
      resetTimeline();
      $("#query").val("");
      recenter();
      d3.json("/"+rootMode, function(json) {
         gData = json;
         gNodes = flatten(gData);
         updateVisualization(gNodes);
         hideWaitPopup();
         d3.json("/"+rootMode+"?p=all", function(json) {
            // update all the data
            updatePeriodData(gNodes, json);
            showTimelineReady();
         });
      });
   });
   $("#recenter").on("click", function() {
      hideMenu();
      recenter();
   });
   $("#show-timeline-button").on("click", function() {
//      showWaitPopup();
//      d3.json("/"+rootMode+"?p=all", function(json) {
         // update all the data
//         updatePeriodData(gNodes, json);
         updateVisualization(gNodes);
         showTimeline();
//         hideWaitPopup();
//      });
   });
   function hideTimeline() {
      $("footer").hide();
      $("#timeline-tabs").hide();
      $("#bigdiva-logo").removeClass("timeline-adjust");
      $("#footer-panel a#help").removeClass("timeline-adjust");
   }
   function showTimeline() {
      $("footer").show();
      $("#timeline-tabs").show();
      $("#bigdiva-logo").addClass("timeline-adjust");
      $("#footer-panel a#help").addClass("timeline-adjust");
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
      resetTimeline();
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
         d3.json("/"+rootMode+"?p=all", function(json) {
            // update all the data
            updatePeriodData(gNodes, json);
            showTimelineReady();
         });
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
      resetTimeline();
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
         d3.json("/"+rootMode+"?p=all", function(json) {
            // update all the data
            updatePeriodData(gNodes, json);
            showTimelineReady();
         });
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
      resetTimeline();
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
         d3.json("/"+rootMode+"?p=all", function(json) {
            // update all the data
            updatePeriodData(gNodes, json);
            showTimelineReady();
         });
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
      resetTimeline();
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
         d3.json("/"+rootMode+"?p=all", function(json) {
            // update all the data
            updatePeriodData(gNodes, json);
            showTimelineReady();
         });
      });
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
//      node.attr("r", nodeSize(d));
      d.collapsedChildren = d.children;
      d.children = null;
      gNodes = flatten(gData);
      updateVisualization(gNodes);
      $("#collapse").hide();
      $("#expand").show();
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
      $("#full-results").hide();
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
   $("#full-results").on("click", function() {
      $("#full-results").hide();
      $("#hide-full-results").show();
      $("#next-results").show();
      $("#prev-results").show();
      var d = $("#menu").data("target");
      hideMenuFacets(d);
      d.fixed = true;
      d3.select("#node-" + d.id).classed("fixed", true).moveParentToFront();
      d3.select("#link-" + d.id).classed("fixed", true); //moveToFront();
      getFullResults(d);
   });
   $("#hide-full-results").on("click", function() {
      $("#hide-full-results").hide();
      $("#full-results").show();
      $("#next-results").hide();
      $("#prev-results").hide();
      var d = $("#menu").data("target");
      showMenuFacets(d);
      clearFullResults(d);
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
    * Facet expansion
    */
   $("#archive").on("click", function() {
      var active =  $(this).find("input[type='checkbox']").prop('checked');
      $("#menu").find("input[type='checkbox']").prop('checked', false);
      var d = $("#menu").data("target");
      if (active === false) {
         d.fixed = true;
         d3.select("#node-" + d.id).classed("fixed", true).moveParentToFront();
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
         d3.select("#node-" + d.id).classed("fixed", true).moveParentToFront();
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
         d3.select("#node-" + d.id).classed("fixed", true).moveParentToFront();
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
         d3.select("#node-" + d.id).classed("fixed", true).moveParentToFront();
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

   d3.select('#tab-decade').classed("active", true);
   d3.select('#timeline-decade').call(d3.slider().value([1400, 1409]).axis(true).min(400).max(2100).step(10).animate(false).fixedRange(true)
         .on("slide", function(evt, value) {
            var which_decade = value[0];
            recalcSizeForDecade(gNodes, which_decade);
            gYearRangeStart = which_decade;
            gYearRangeEnd = which_decade + 9;
            gActiveTimeline = "decade";
         })
   );
   d3.select('#tab-decade').classed("active", false);
   d3.select('#tab-quarter-century').classed("active", true);
   d3.select('#timeline-quarter-century').call(d3.slider().value([1400, 1424]).axis(true).min(400).max(2100).step(25).animate(false).fixedRange(true)
         .on("slide", function(evt, value) {
            var which_quarter_century = value[0];
            recalcSizeForQuarterCentury(gNodes, which_quarter_century);
            gYearRangeStart = which_quarter_century;
            gYearRangeEnd = which_quarter_century + 24;
            gActiveTimeline = "quarter-century";
         })
   );
   d3.select('#tab-quarter-century').classed("active", false);
   d3.select('#tab-half-century').classed("active", true);
   d3.select('#timeline-half-century').call(d3.slider().value([1400, 1449]).axis(true).min(400).max(2100).step(50).animate(false).fixedRange(true)
         .on("slide", function(evt, value) {
            var which_half_century = value[0];
            recalcSizeForHalfCentury(gNodes, which_half_century);
            gYearRangeStart = which_half_century;
            gYearRangeEnd = which_half_century + 49;
            gActiveTimeline = "half-century";
         })
   );
   d3.select('#tab-half-century').classed("active", false);
   d3.select('#tab-century').classed("active", true);
   d3.select('#timeline-century').call(d3.slider().value([1400, 1499]).axis(true).min(400).max(2100).step(100).animate(false).fixedRange(true)
         .on("slide", function(evt, value) {
            var which_century = value[0];
            recalcSizeForCentury(gNodes, which_century);
            gYearRangeStart = which_century;
            gYearRangeEnd = which_century + 99;
            gActiveTimeline = "century";
         })
   );
   d3.select('#tab-century').classed("active", false);
   d3.select('#tab-first-pub').classed("active", true);
   d3.select('#timeline-first-pub').call(d3.slider().value([400, 2100]).axis(true).min(400).max(2100).step(1).animate(false)
         .on("slide", function(evt, value) {
            var start_year = value[0];
            var end_year = value[1];
            recalcSizeForFirstPubYears(gNodes, start_year, end_year);
            gYearRangeStart = start_year;
            gYearRangeEnd = end_year;
            gActiveTimeline = "first-pub";
         })
   );
   hideTimeline();
   $("#show-timeline-button").hide();
   $("#loading-timeline").hide();


   var force = d3.layout.force().size([gWidth, gHeight])
   	  .linkDistance(calcLinkDistance)
        .linkStrength(calcLinkStrength)
   	  .charge(calcCharge)
//      .chargeDistance(1000)
      // following are default values
      .friction(0.8)
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
      {"id":"gradient-arc-root-normal",     "color":"#a2a2a2", "highlight":"#f9f9f9"}, // grey
      {"id":"gradient-arc-root-selected",   "color":"#a8a8a8", "highlight":"#ffffff"},
      {"id":"gradient-resource-parent",    "color":"#132945", "highlight":"#1166AA"},
      {"id":"gradient-resource-parent-selected",  "color":"#1166AA", "highlight":"#f0f9e8"},
      {"id":"gradient-resource-normal",    "color":"#0868ac", "highlight":"#43a2ca"}, // blues: #f0f9e8, #bae4bc, #7bccc4, #43a2ca, #0868ac
      {"id":"gradient-resource-collapsed", "color":"#bae4bc", "highlight":"#0868ac"},
      {"id":"gradient-resource-fixed",     "color":"#0868ac", "highlight":"#7bccc4"},
      {"id":"gradient-resource-selected",  "color":"#43a2ca", "highlight":"#f0f9e8"},
      {"id":"gradient-resource-disabled",     "color":"#686868", "highlight":"#a2a2a2"}, // grey
      {"id":"gradient-resource-disabled-selected",   "color":"#a2a2a2", "highlight":"#f9f9f9"},
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
         var off = $("#menu").offset();

         $("#menu").offset({
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
         //      d.fixed = true;
         //      d3.select("#node-" + d.id).classed("fixed", true);
         d3.event.stopPropagation();
         if (d.type !== "stack") {
            var pos = d3.mouse($("#main-content")[0]);
            tipX = pos[0];
            tipY = pos[1];
            showPopupMenu(d);
         }
      }
   }

   function nodeMouseDown(d) {
      if (d.type === "stack") {
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
   }


   var drag = force.drag().on("dragstart", onDragStart)
      .on("drag", onDrag)
      .on("dragend", function() {dragging = false;});

   // request the initial set of data; the archives
   d3.json("/archives", function(json) {
      gData = json;
      gNodes = flatten(gData);
      updateVisualization(gNodes);
      $("#loading-timeline").show();
      d3.json("/archives?p=all", function(json) {
         // update all the data
         updatePeriodData(gNodes, json);
         showTimelineReady();
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
            .classed("no-data", isNoData)
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
         } else if (d.type === "root" || d.type == "stack" || d.type == "object" || d.size === 0
            || ((d.type == "archive" || (d.type == "subfacet" && d.facet == "archive")) && d.enabled == false)) {
            $("#full-results").hide();
         } else {
            $("#full-results").show();
         }
         $("#menu").data("target", d);
         if (d.choice == "results") {
            $("#hide-full-results").show();
            $("#next-results").show();
            $("#prev-results").show();
         } else {
            $("#hide-full-results").hide();
            $("#next-results").hide();
            $("#prev-results").hide();
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

         if (d.type == "object") {
            $("tr#uri").show();
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
         if (!collapsed && d.size && isLeaf(d) && d.choice !== "results"
            && ((d.type != "archive" && d.facet != "archive") || d.enabled==true)) {
             showMenuFacets(d);
         } else {
            $("#menu hr").hide();

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
         menuNode = false;
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
//               console.log("node " + entry.name + " (" + entry.size + ") COPIED");
            }
         }
         if (entry.children) {
            updatePeriodData(nodes, entry);
         }
      }
   }

   // makes new deep copy of years list
   function sumYearList(years, addYears) {
      var resultYears = (years instanceof Array) ? JSON.parse(JSON.stringify(years)) : [];
      if (addYears instanceof Array) {
         for (var year in addYears) {
            if (resultYears[year]) {
               resultYears[year] += addYears[year];
            } else {
               resultYears[year] = addYears[year];
            }
//   console.log(' Add: '+year+' = '+resultYears[year]);
         }
      }
      return resultYears;
   }

   // makes new deep copy of years list
   function subYearList(years, subYears) {
      var resultYears = (years instanceof Array) ? JSON.parse(JSON.stringify(years)) : [];
      if (subYears instanceof Array) {
         for (var year in subYears) {
            if (resultYears[year]) {
               resultYears[year] -= subYears[year];
            } else {
               resultYears[year] = -subYears[year];
            }
//         console.log(' Sub: '+year+' = '+resultYears[year]);
         }
      }
      return resultYears;
   }

   function makeSummaryNode(json, shouldCountFixedNodes) {
      var newNode = { "first_pub_year" : {}, "decade" : {}, "quarter_century": {}, "half_century": {}, "century": {}};
      if (json == null) return newNode;
      for (var i in json) {
//    console.log("*** summing node "+i);
         var entry = json[i];
         if (shouldCountFixedNodes || (entry.fixed == false)) {
            var hasPeriodData = (typeof entry.first_pub_year != "undefined");
            if (hasPeriodData) {
               newNode.first_pub_year = sumYearList(newNode.first_pub_year, entry.first_pub_year);
//    console.log("first pub year ("+Object.keys(node.first_pub_year).length+")");
               newNode.decade = sumYearList(newNode.decade, entry.decade);
//    console.log("decade ("+Object.keys(node.decade).length+")");
               newNode.quarter_century = sumYearList(newNode.quarter_century, entry.quarter_century);
//    console.log("quarter century ("+Object.keys(node.quarter_century).length+")");
               newNode.half_century = sumYearList(newNode.half_century, entry.half_century);
//    console.log("half century ("+Object.keys(node.half_century).length+")");
               newNode.century = sumYearList(newNode.century, entry.century);
//    console.log("century ("+Object.keys(node.century).length+")");
            }
         }
      }
      return newNode;
   }

   function subtractNodeYearCounts(node, subNode) {
      var newNode = { "first_pub_year" : {}, "decade" : {}, "quarter_century": {}, "half_century": {}, "century": {}};
      newNode.first_pub_year = subYearList(node.first_pub_year, subNode.first_pub_year);
//         console.log("first pub year ("+Object.keys(summary.first_pub_year).length+")");
      newNode.decade = subYearList(node.decade, subNode.decade);
//         console.log("decade ("+Object.keys(summary.decade).length+")");
      newNode.quarter_century = subYearList(node.quarter_century, subNode.quarter_century);
//         console.log("quarter century ("+Object.keys(summary.quarter_century).length+")");
      newNode.half_century = subYearList(node.half_century, subNode.half_century);
//         console.log("half century ("+Object.keys(summary.half_century).length+")");
      newNode.century = subYearList(node.century, subNode.century);
//         console.log("century ("+Object.keys(summary.century).length+")");
      return newNode;
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

   function updateMenuForNode(node) {
      if (node.id == selectedNodeId) {
//               console.log("found active Node "+node.id);
         $("#info td#size").text(commaSeparateNumber(node.size));
         if (node.type === "stack") {
            $("#info td.title").text(node.name);
         }
         if (node.size > 0) {
            $("#full-results").show();
         } else {
            $("#full-results").hide();
         }
      }
   }

   function updateNodeSize(node, count) {
      node.size = count;
      var newSize = fastNodeSize(count);
//            console.log(count + " -> "+newSize);
      var circle = d3.select("#node-" + node.id);
      var caption = d3.select("#caption-" + node.id);
      if (node.type == "object") {
         var link = d3.select("#link-" + node.id );
         if (count == 0) {
            circle.attr("visibility", "hidden");
            caption.attr("visibility", "hidden");
            link.attr("visibility", "hidden");
         } else {
            circle.attr("visibility", "visible");
            caption.attr("visibility", "visible");
            link.attr("visibility", "visible");
         }
         return;
      } else if (node.type === "stack") {
         var parentNode = node.parentNode;
         var countStr = commaSeparateNumber(count);
         var totalStr = commaSeparateNumber(parentNode.size);
         if (node.isPrev === true) {
            node.name = "Prev "+countStr+" of "+totalStr+"...";
         } else {
            node.name = "Next "+countStr+" of "+totalStr+"...";
         }
         caption.text(node.name);
      }
      circle.attr("r", newSize).classed("empty", count == 0);
      caption.style("fill", function(d) { return (count > 0) ? "white": "rgba(255,255,255,0.5)"; });
   }

   function recalcSizeForFirstPubYears(nodes, start_year, end_year) {
      for (var i = 0; i < nodes.length; i++) {
         var node = nodes[i];
         if (node.type != "group" && node.type != "root" && node.type != "stack") {
            var count = sizeForFirstPubYears(node.first_pub_year, start_year, end_year);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
      for (var i = 0; i < nodes.length; i++) {
         var node = nodes[i];
         if (node.type == "stack") {
            var count = sizeForFirstPubYears(node.first_pub_year, start_year, end_year);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
   }

   function recalcSizeForDecade(nodes, which_decade) {
      for (var i = 0; i < nodes.length; i++) {
         var node = nodes[i];
         if (node.type != "group" && node.type != "root" && node.type != "stack") {
            var count = sizeForDecade(node.decade, which_decade);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
      for (var i = 0; i < nodes.length; i++) {
         var node = nodes[i];
         if (node.type == "stack") {
            var count = sizeForDecade(node.decade, which_decade);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
   }

   function recalcSizeForQuarterCentury(nodes, which_quarter_century) {
      for (var i = 0; i < nodes.length; i++) {
         var node = nodes[i];
         if (node.type != "group" && node.type != "root" && node.type != "stack") {
            var count = sizeForQuarterCentury(node.quarter_century, which_quarter_century);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
      for (var i = 0; i < nodes.length; i++) {
         var node = nodes[i];
         if (node.type == "stack") {
            var count = sizeForQuarterCentury(node.quarter_century, which_quarter_century);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
   }

   function recalcSizeForHalfCentury(nodes, which_half_century) {
      for (var i = 0; i < nodes.length; i++) { // get everything but the stacks
         var node = nodes[i];
         if (node.type != "group" && node.type != "root" && node.type != "stack") {
            var count = sizeForHalfCentury(node.half_century, which_half_century);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
      for (var i = 0; i < nodes.length; i++) { // now get the stacks which use data in the parent
         var node = nodes[i];
         if (node.type == "stack") {
            var count = sizeForHalfCentury(node.half_century, which_half_century);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
   }

   function recalcSizeForCentury(nodes, which_century) {
      for (var i = 0; i < nodes.length; i++) {
         var node = nodes[i];
         if (node.type != "group" && node.type != "root" && node.type != "stack") {
            var count = sizeForCentury(node.century, which_century);
            updateNodeSize(node, count);
            updateMenuForNode(node);
         }
      }
      for (var i = 0; i < nodes.length; i++) {
         var node = nodes[i];
         if (node.type == "stack") {
            var count = sizeForCentury(node.century, which_century);
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