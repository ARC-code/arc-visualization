$(function() {
   var width = $(window).width();
   var height = $(window).height()-$("#site-header").outerHeight(true)-20;
   var root;
   var force = d3.layout.force().size([width, height]).linkStrength(0.1).gravity(0.05).charge(calcCharge).chargeDistance(Math.max(width,height)).on("tick", tick);
   var svg = d3.select("#main-content").append("svg").attr("width", width).attr("height", height);
   $("svg").hide();
   var link = svg.selectAll(".link");
   var node = svg.selectAll(".node");

   // request the initial set of data; the archives
   d3.json("/archives", function(json) {
      root = json;
      updateArchives();
   });

   function calcCharge(d) {
      var foo = Math.sqrt(d.size) / 10 || 3;
      return -15*foo;
   }

   // handle nodes beign dragged
   var drag = force.drag().on("drag", dragstart);

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
      node.enter().append("circle").attr("class", "node").attr("cx", function(d) {
         return d.x;
      }).attr("cy", function(d) {
         return d.y;
      }).attr("r", function(d) {
         if ( d.name === "ARC Catalog") {
            d3.select(this).classed("root", true);
            return 20;
         }
         if (d.children) {
            return 10;
         }
         return Math.sqrt(d.size) / 10 || 4.5;
      }).style("fill", color).classed("fixed", isFixed).on("click", click).on("dblclick", dblclick).call(drag).append("svg:title").text( nodeTitle );

   }

   function tick() {
     link.attr("x1", function(d) { return d.source.x; })
         .attr("y1", function(d) { return d.source.y; })
         .attr("x2", function(d) { return d.target.x; })
         .attr("y2", function(d) { return d.target.y; });

     node.attr("cx", function(d) { return d.x; })
         .attr("cy", function(d) { return d.y; });
   }

   function isFixed(d) {
      return d.fixed;
   }

   function color(d) {
      if ( d.name === "ARC Catalog") {
         return "bisque";
      } else {
         if ( d._children ) {
            // collapsed
            return "#9af";
         } else {
            if (d.children) {
               return "#dedede";
            } else {
               // leaf
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


   // Toggle children on dblclick.
   function click(d) {
      if (!d3.event.defaultPrevented) {
         if (d.children) {
            //d3.select(this).attr("r", Math.max(Math.sqrt(d.size) / 50, 4.5) );
            d3.select(this).attr("r", Math.sqrt(d.size) / 10 || 4.5 );
            d._children = d.children;
            d.children = null;
         } else {
            //d3.select(this).attr("r", Math.sqrt(d.size) / 10 || 4.5 );
            d3.select(this).attr("r", 10 );
            d.children = d._children;
            d._children = null;
         }
         updateArchives();
      }
   }

   // Un-fix on click.
   function dblclick(d) {
      d.fixed = false;
      d3.select(this).classed("fixed", false);
   }

   function dragstart(d) {
     d3.select(this).classed("fixed", d.fixed = true);
   };


   // Returns a list of all nodes under the root.
   function flatten(root) {
      var nodes = [], i = 0;

      function recurse(node) {
         if (node.children)
            node.children.forEach(recurse);
         if (!node.id)
            node.id = ++i;
         nodes.push(node);
      }

      recurse(root);
      return nodes;
   }

});