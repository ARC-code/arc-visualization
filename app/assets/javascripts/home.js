$(function() {

   $("body").on("click", function() {
      $("#menu").hide();
   });
   $("#collapse").on("click", function() {
      var d = $("#menu").data("target");
      $("#menu").data("node").attr("r", Math.sqrt(d.size) / 10 || 4.5);
      d._children = d.children;
      d.children = null;
      $("#menu").hide();
      updateArchives();
   });
   $("#expand").on("click", function() {
      var d = $("#menu").data("target");
      $("#menu").data("node").attr("r", 10);
      d.children = d._children;
      d._children = null;
      updateArchives();
      $("#menu").hide();
   });
   $("#unpin").on("click", function() {
      var d = $("#menu").data("target");
      d.fixed = false;
      $("#menu").data("node").classed("fixed", false);
      $("#menu").hide();
   });


   // Calc charge on node based on size. Bigger nodes repel more
   var calcCharge = function(d) {
      var size = Math.sqrt(d.size) / 10 || 3;
      return -15 * size;
   };

   // Initialize D3 visualization
   var width = $(window).width();
   var height = $(window).height() - $("#site-header").outerHeight(true) - 20;
   var root;
   var force = d3.layout.force().size([width, height]).linkStrength(0.1).gravity(0.05).charge(calcCharge).chargeDistance(Math.max(width, height)).on("tick", tick);
   var svg = d3.select("#main-content").append("svg").attr("width", width).attr("height", height);
   $("svg").hide();
   var link = svg.selectAll(".link");
   var node = svg.selectAll(".node");

   // request the initial set of data; the archives
   d3.json("/archives", function(json) {
      root = json;
      updateArchives();
   });

   // handle nodes being dragged
   var drag = force.drag().on("drag", onDragStart);

   // Redraw the d3 graph based on JSON data
   function updateArchives() {
      $("#wait").remove();
      $("svg").show();
      var nodes = flatten(root);
      var links = d3.layout.tree().links(nodes);

      // Restart the force layout.
      force.nodes(nodes).links(links).start();

      // Update the links…
      link = link.data(links, function(d) {
         return d.target.id;
      });

      // Exit any old links.
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

      // Update the nodes…
      node = node.data(nodes, function(d) {
         return d.id;
      }).style("fill", color);

      // Exit any old nodes.
      node.exit().remove();

      // Enter any new nodes.
      var circle = node.enter().append("circle").attr("class", "node").attr("cx", function(d) {
         return d.x;
      }).attr("cy", function(d) {
         return d.y;
      }).attr("r", function(d) {
         if (d.name === "ARC Catalog") {
            d3.select(this).classed("root", true);
            return 20;
         }
         if (d.children) {
            return 10;
         }
         return Math.max(Math.sqrt(d.size) / 10 || 4.5, 5);
      }).style("fill", color).classed("fixed", isFixed).on("click", click).on("dblclick", onDoubleClick).call(drag);

      circle.append("svg:title").text(nodeTitle);
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
      });
   }

   function isFixed(d) {
      return d.fixed;
   }

   function color(d) {
      if (d.name === "ARC Catalog") {
         return "bisque";
      } else {
         if (d._children) {
            // collapsed
            return "#00a";
         } else {
            if (d.children) {
               // expanded parent
               return "#dedede";
            } else {
               // leaf
               if (!d.size) {
                  // no data from collex
                  return "rgba(100,100,175,0.7)";
               }
               return "#62b1f9";
            }
         }
      }
   }

   function nodeTitle(d, i) {
      if (d.size) {
         return d.name + ": " + d.size;
      } else {
         return d.name;
      }
   }

   // Handle click on a node; configure and display the menu
   function click(d) {
      if (!d3.event.defaultPrevented) {
         if (d.children) {
            $("#collapse").show();
            $("#expand").hide();
         } else {
            $("#expand").show();
            $("#collapse").hide();
         }
         $("#menu").show();
         $("#menu").offset({
            top : d.y + 10,
            left : d.x+10
         });
         $("#menu").data("target", d);
         $("#menu").data("node",  d3.select(this));
         d.fixed = true;
         d3.select(this).classed("fixed", true);
         d3.event.stopPropagation();
      }
   }

   // Un-fix on double click.
   function onDoubleClick(d) {
      d.fixed = false;
      d3.select(this).classed("fixed", false);
   }

   function onDragStart(d) {
      $("#menu").hide();
      d3.select(this).classed("fixed", d.fixed = true);
   };

   // Returns a list of all nodes under the root.
   function flatten(root) {
      var nodes = [], i = 0;

      function recurse(node) {
         if (node.children) {
            node.children.forEach(recurse);
         }
         if (!node.id) {
            node.id = ++i;
         }
         nodes.push(node);
      }

      recurse(root);
      return nodes;
   }

});