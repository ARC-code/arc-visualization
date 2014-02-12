/*global $, d3, window */

$(function() {

   var dragging = false;
   var width = $(window).width();
   var height = $(window).height() - $("#site-header").outerHeight(true) - 10;
   var tipShowTimer = -1;
   var tipX;
   var tipY;
   var data;
   var transX = 1;
   var transY = 1;
   var scale = 1;
   var vis;
   var lastId = 0;

   var insertData = function(target, jsonData) {
      function find(node, target) {
         if ( node.handle === target ) {
            return node;
         }

         if (node.children) {
            var idx;
            for (idx = 0; idx < node.children.length; ++idx) {
               var res = find( node.children[idx], target );
               if ( res ) {
                  return res;
               }
            }
         }
         return null;
      }

      var parent = find(data, target);
      parent.children = jsonData;
   };

   // get details for a facet on the specified node
   var getFacetDetail = function(d, facetName) {
      if ( !d.facets ) {
         d.facets = [];
      }
      d.facets.push(facetName);
      d3.json("/facet?a="+d.handle+"&f="+facetName+"&v=all", function(json) {
         var node = d3.select("#circle-"+d.id);
         node.classed("leaf", false);
         node.classed("parent", true);
         insertData(d.handle, json);
         updateVisualization();
      });
   };

   // Handlers for popup menu actions
   $("body").on("click", function() {
      $("#menu").hide();
   });
   $("#collapse").on("click", function() {
      var d = $("#menu").data("target");
      var node = d3.select("#circle-"+d.id);
      node.attr("r", Math.sqrt(d.size) / 10 || 4.5);
      node.classed("collapsed", true);
      d.collapsedChildren = d.children;
      d.children = null;
      $("#menu").hide();
      updateVisualization();
   });
   $("#expand").on("click", function() {
      var d = $("#menu").data("target");
      var node = d3.select("#circle-"+d.id);
      node.attr("r", 10);
      node.classed("collapsed", false);
      d.children = d.collapsedChildren;
      d.collapsedChildren = null;
      updateVisualization();
      $("#menu").hide();
   });
   $("#unpin").on("click", function() {
      var d = $("#menu").data("target");
      d.fixed = false;
      d3.select("#circle-"+d.id).classed("fixed", false);
      $("#menu").hide();
   });
   $("#genre").on("click", function() {
      var d = $("#menu").data("target");
      $("#menu").hide();
      getFacetDetail(d, "genre");
   });
   $("#discipline").on("click", function() {
      var d = $("#menu").data("target");
      $("#menu").hide();
      getFacetDetail(d, "discipline");
   });
   $("#format").on("click", function() {
      var d = $("#menu").data("target");
      $("#menu").hide();
      getFacetDetail(d, "format");
   });

   // Calc charge on node based on size. Bigger nodes repel more
   var calcCharge = function(d) {
      var size = Math.sqrt(d.size) / 10 || 3;
      return -15 * size;
   };

   // Pan/Zoom behavior
   var zoom = d3.behavior.zoom().scaleExtent([1, 5]).on("zoom", function() {
      vis.attr("transform","translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")");
      transX = d3.event.translate[0];  // track the settings so the popup
      transY = d3.event.translate[1];  // menu and tooltip popups appear in
      scale = d3.event.scale;          // the correct place
   });

   // Initialize D3 visualization
   var force = d3.layout.force().size([width, height]).linkStrength(0.1).gravity(0.05).charge(calcCharge).chargeDistance(Math.max(width, height)).on("tick", tick);
   vis = d3.select("#main-content")
      .append("svg:svg")
         .attr("width", width)
         .attr("height", height)
      .append('svg:g').attr("id", "transform-group")
         .call(zoom)
      .append('svg:g');   // without this extra group, pan is jittery

   // add a fullscreen block as the background for the visualization
   // this catches mouse events that are not on the circles and lets the
   // whole thing be panned / zoomed
   vis.append('svg:rect').attr('width', width).attr('height', height).attr('fill','white');

   $("svg").hide();
   var link = vis.selectAll("g.link");    // all of the connecting lines
   var node = vis.selectAll("g.node");    // all of the circles

   // Node drag behavior
   var drag = force.drag().on("dragstart", onDragStart);
   function onDragStart(d) {
      $("#menu").hide();
      $("#info").hide();
      dragging = true;
      if (tipShowTimer !== -1) {
         clearTimeout(tipShowTimer);
         tipShowTimer = -1;
      }
      d3.select("#circle-"+d.id).classed("fixed", d.fixed = true);
      d3.event.sourceEvent.stopPropagation();
   }

   force.drag().on("dragend", function() {dragging = false;});

   // request the initial set of data; the archives
   d3.json("/archives", function(json) {
      data = json;
      updateVisualization();
   });

   /**
    * Redraw the d3 graph based on JSON data
    */
   function updateVisualization() {
      console.log(JSON.stringify(data));
      var nodes = flatten(data);
      var links = d3.layout.tree().links(nodes);

      // Restart the force layout.
      force.nodes(nodes).links(links).start();

      // Update the links
      link = link.data(links, function(d) {
         return d.target.id;
      });
      link.exit().remove();

      // Enter any new links.
      link.enter().insert("line", ".node").attr("class", "link").attr("x1", function(d) {
         return d.source.x;
      }).attr("y1", function(d) {
         return d.source.y;
      }).attr("x2", function(d) {
         return d.target.x;
      }).attr("y2", function(d) {
         return d.target.y;
      });

      // Update the nodes
      node = node.data(nodes, function(d) {
         return d.id;
      });
      node.exit().remove();

      // Enter any new nodes; create a draggable group that contains the circle.
      // Radius depends on size of circle
      // mouse over triggers title popup and click opens node menu.
      var circle = node.enter()
         .append("svg:g")
            .attr("class", "node").call(drag)
         .append("svg:circle")
            .on("click", click)
            .on("mouseenter", onMouseOver)
            .on("mouseleave", onMouseLeave)
            .classed("fixed", isFixed)
            .classed("leaf", isLeaf)
            .classed("no-data", isNoData)
            .classed("parent", isParent)
            .attr("id", function(d) {
               return "circle-"+d.id;
            })
            .attr("r", function(d) {
               if (d.type == "root") {
                  d3.select(this).classed("root", true);
                  return 20;
               }
               if (d.children) {
                  return 10;
               }
               return Math.max(Math.sqrt(d.size) / 10 || 4.5, 5);
            });


      // visualization is laid out. now fade out the wait and fade in viz
      $("#wait").hide();
      $("svg").fadeIn();
   }

   function isLeaf(d) {
      return (d.type=="archive");
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

      node.attr("cx", function(d) {
         return d.x;
      }).attr("cy", function(d) {
         return d.y;
      }).attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")";});

   }

   function isFixed(d) {
      return d.fixed;
   }

   function color(d) {
      if (d.name === "ARC Catalog") {
         return "bisque";
      }

      // parent node
      if (d.collapsedChildren || d.children ) {
         return "#dedede";
      }

      // leaf
      if (!d.size) {
         // no data from collex
         return "rgba(100,100,175,0.7)";
      }
      return "#62b1f9";
   }

   function onMouseOver(d) {
      if (dragging === false && $("#menu").is(":visible") === false) {
         var tipTarget = d;
         tipX = d3.event.pageX + 10;
         tipY = d3.event.pageY + 10;
         if (tipShowTimer === -1) {
            tipShowTimer = setTimeout(function() {
               $("#info .title").text(d.name);
               $("#info .size").text(d.size);
               $("#info").css({
                  "top" : d.y*scale+transY + "px",
                  "left" : d.x*scale+transX + "px"
               });
               $("#info").fadeIn();
            }, 750);
         }

      }
   }

   function onMouseLeave(d) {
      if (tipShowTimer !== -1) {
         clearTimeout(tipShowTimer);
         tipShowTimer = -1;
      }
      $("#info").fadeOut();
   }

   // test if a node has the specified facet data
   var hasFacet = function(d, facet) {
      var facets = d.facets;
      return ( typeof facets !== "undefined" && $.inArray(facet, facets) > -1 );
   };

   // Handle click on a node; configure and display the menu
   function click(d) {
      if (!d3.event.defaultPrevented) {
         // end any hover timer that might pop a title tip
         if (tipShowTimer !== -1) {
            clearTimeout(tipShowTimer);
            tipShowTimer = -1;
         }

         var collapsed = false;
         $("#expand").hide();
         $("#collapse").hide();
         if (d.children) {
            $("#collapse").show();
         } else if ( d.collapsedChildren) {
            $("#expand").show();
            collapsed = true;
         }
         $("#menu").fadeIn();
         $("#menu").offset({
            top :  (d.y+10)*scale+transY,
            left : (d.x+10)*scale+transX
         });
         $("#menu").data("target", d);
         d.fixed = true;
         d3.select("#circle-"+d.id).classed("fixed", true);
         d3.event.stopPropagation();

         $("#genre").hide();
         $("#discipline").hide();
         $("#format").hide();
         if ( !collapsed && d.size && d.type=="archive" ) { // FIXME
            if ( hasFacet(d, "genre") === false ) {
               $("#genre").show();
            }
            if ( hasFacet(d, "discipline") === false ) {
               $("#discipline").show();
            }
            if ( hasFacet(d, "format") === false ) {
               $("#format").show();
            }
         }
      }
   }

   // Returns a list of all nodes under the root.
   function flatten(root) {
      var nodes = [], i = lastId;

      function recurse(node) {
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