/*
 D3.js Slider
 Inspired by jQuery UI Slider
 Copyright (c) 2013, Bjorn Sandvik - http://blog.thematicmapping.org
 BSD license: http://opensource.org/licenses/BSD-3-Clause
 */

d3.slider = function module() {
   "use strict";

   // Public variables width default settings
   var min = 0,
      max = 100,
      step = 0.01,
      animate = true,
      orientation = "horizontal",
      axis = false,
      margin = 50,
      value,
      active = 1,
      fixedRange = false,
      scale;

   // Private variables
   var axisScale,
      dispatch = d3.dispatch("slide", "slideend"),
      formatPercent = d3.format(".2%"),
      tickFormat = d3.format(".0"),
      sliderLength,
      unusedDragX = 0;

   function slider(selection) {
      selection.each(function() {

         // Create scale if not defined by user
         if (!scale) {
            scale = d3.scale.linear().domain([min, max]);
         }

         // Start value
         value = value || scale.domain()[0];

         // DIV container
         var div = d3.select(this).classed("d3-slider d3-slider-" + orientation, true);

         var drag = d3.behavior.drag();
         drag.on('dragstart', function () {
            if (d3.event.sourceEvent.target.id === "handle-range") {
               active = 3;
            } else if (d3.event.sourceEvent.target.id === "handle-one") {
               active = 1;
            } else if (d3.event.sourceEvent.target.id == "handle-two") {
               active = 2;
            }
         });
         drag.on('dragend', function () {
            dispatch.slideend(d3.event, value);
            unusedDragX = 0;
            active = 0;
         });

         // Slider handle
         //if range slider, create two
         var handle1, handle2 = null, divRange;
         var valdisplay1, valdisplay2, rangedisplay = null;

         if ( value.length == 2 ) {
            if (!fixedRange) {
               handle1 = div.append("a")
                  .classed("d3-slider-handle", true)
                  .attr("xlink:href", "#")
                  .attr('id', "handle-one")
                  .on("click", stopPropagation)
                  .call(drag);
               valdisplay1 = handle1.append("div").attr("id", "d3-slider-start-display").text(value[0]);
               handle2 = div.append("a")
                  .classed("d3-slider-handle", true)
                  .attr('id', "handle-two")
                  .attr("xlink:href", "#")
                  .on("click", stopPropagation)
                  .call(drag);
               valdisplay2 = handle2.append("div").attr("id", "d3-slider-end-display").text(value[1]);
            }
         } else {
            handle1 = div.append("a")
               .classed("d3-slider-handle", true)
               .attr("xlink:href", "#")
               .attr('id', "handle-one")
               .on("click", stopPropagation)
               .call(drag);
            valdisplay1 = handle1.append("div").attr("id", "d3-slider-start-display").text(value[0]);
         }

         // Horizontal slider
         if (orientation === "horizontal") {

            div.on("click", onClickHorizontal);

            if ( value.length == 2 ) {
               divRange = d3.select(this).append('div')
                  .classed("d3-slider-range", true)
                  .attr('id', "handle-range")
                  .call(drag);

               if (!fixedRange) {
                  handle1.style("left", formatPercent(scale(value[ 0 ])));
                  handle2.style("left", formatPercent(scale(value[ 1 ])));
               }

               divRange.style("left", formatPercent(scale(value[ 0 ])));

               var width = 100 - parseFloat(formatPercent(scale(value[ 1 ])));
               divRange.style("right", width+"%");
               drag.on("drag", onDragHorizontal);
               rangedisplay = divRange.append("div").attr("id", "d3-slider-range-display").text(fixedRange ? (value[0] + ' - ' + value[1]) : '');

            } else {
               handle1.style("left", formatPercent(scale(value)));
               drag.on("drag", onDragHorizontal);
            }

            sliderLength = parseInt(div.style("width"), 10);

         } else { // Vertical

            div.on("click", onClickVertical);
            drag.on("drag", onDragVertical);
            if ( value.length == 2 ) {
               divRange = d3.select(this).append('div').classed("d3-slider-range-vertical", true);

               handle1.style("bottom", formatPercent(scale(value[ 0 ])));
               divRange.style("bottom", formatPercent(scale(value[ 0 ])));
               drag.on("drag", onDragVertical);

               var top = 100 - parseFloat(formatPercent(scale(value[ 1 ])));
               handle2.style("bottom", formatPercent(scale(value[ 1 ])));
               divRange.style("top", top+"%");
               drag.on("drag", onDragVertical);

            } else if (!fixedRange) {
               handle1.style("bottom", formatPercent(scale(value)));
               drag.on("drag", onDragVertical);
            }

            sliderLength = parseInt(div.style("height"), 10);

         }

         if (axis) {
            createAxis(div);
         }


         function createAxis(dom) {

            // Create axis if not defined by user
            if (typeof axis === "boolean") {

               axis = d3.svg.axis()
                  .ticks(Math.round(sliderLength / 100))
                  .tickFormat(tickFormat)
                  .orient((orientation === "horizontal") ? "bottom" :  "right");

            }

            // Copy slider scale to move from percentages to pixels
            axisScale = scale.copy().range([0, sliderLength]);
            axis.scale(axisScale);

            // Create SVG axis container
            var svg = dom.append("svg")
               .classed("d3-slider-axis d3-slider-axis-" + axis.orient(), true)
               .on("click", stopPropagation);

            var g = svg.append("g");

            // Horizontal axis
            if (orientation === "horizontal") {

               svg.style("margin-left", -margin + "px");

               svg.attr({
                  width: sliderLength + margin * 2,
                  height: margin
               });

               if (axis.orient() === "top") {
                  svg.style("top", -margin + "px");
                  g.attr("transform", "translate(" + margin + "," + margin + ")");
               } else { // bottom
                  g.attr("transform", "translate(" + margin + ",0)");
               }

            } else { // Vertical

               svg.style("top", -margin + "px");

               svg.attr({
                  width: margin,
                  height: sliderLength + margin * 2
               });

               if (axis.orient() === "left") {
                  svg.style("left", -margin + "px");
                  g.attr("transform", "translate(" + margin + "," + margin + ")");
               } else { // right
                  g.attr("transform", "translate(" + 0 + "," + margin + ")");
               }

            }

            g.call(axis);

//            console.log( g.selectAll("line") );
//            console.log( axisScale.ticks(sliderLength/10) );

            g.selectAll("line").data(axisScale.ticks(sliderLength / 10), function (d) {
               return d;
            })
               .enter()
               .append("line")
               .attr("class", "minor")
               .attr("y1", 0)
               .attr("y2", 4)
               .attr("x1", axisScale)
               .attr("x2", axisScale);

         }


         // Move slider handle on click/drag
         function moveHandle(pos) {

            var newValue = stepValue(scale.invert(pos / sliderLength)),
               currentValue = value.length ? value[active - 1]: value;

            if (currentValue !== newValue) {
               var oldPos = formatPercent(scale(stepValue(currentValue))),
                  newPos = formatPercent(scale(stepValue(newValue))),
                  position = (orientation === "horizontal") ? "left" : "bottom";

               if ( value.length === 2) {
                  value[ active - 1 ] = newValue;
                  dispatch.slide(d3.event, value );
               } else {
                  dispatch.slide(d3.event.sourceEvent || d3.event, value = newValue);
               }

               if ( value[ 0 ] >= value[ 1 ] ) return;
               if ( active === 1 ) {

                  valdisplay1.text(value[0]);

                  if (value.length === 2) {
                     (position === "left") ? divRange.style("left", newPos) : divRange.style("bottom", newPos);
                  }

                  if (animate) {
                     handle1.transition()
                        .styleTween(position, function() { return d3.interpolate(oldPos, newPos); })
                        .duration((typeof animate === "number") ? animate : 250);
                  } else {
                     handle1.style(position, newPos);
                  }
               } else {

                  valdisplay2.text(value[1]);

                  var width = 100 - parseFloat(newPos);
                  var top = 100 - parseFloat(newPos);

                  (position === "left") ? divRange.style("right", width + "%") : divRange.style("top", top + "%");

                  if (animate) {
                     handle2.transition()
                        .styleTween(position, function() { return d3.interpolate(oldPos, newPos); })
                        .duration((typeof animate === "number") ? animate : 250);
                  } else {
                     handle2.style(position, newPos);
                  }
               }
            }

         }

         function moveRange(deltaX, snapToTick) {
            if (typeof snapToTick == "undefined") {
               snapToTick = true;
            }
            var currRange = value[1] - value[0];
            var domain = scale.domain()[1] - scale.domain()[0];
            var ratio = domain/sliderLength;
            var unsteppedVal = (deltaX + unusedDragX) * ratio;
            unsteppedVal += value[0];
            var val = snapToTick ? stepValue(unsteppedVal) : unsteppedVal;
            var maxVal = scale.domain()[1] - currRange;
            var minVal = scale.domain()[0];
            val = Math.max(minVal, Math.min(maxVal, val));
            if (val != value[0]) {
               unusedDragX = (unsteppedVal - val)/ratio;
               var oldPos0 = formatPercent(scale(value[0])),
                  oldPos1 = formatPercent(scale(value[1])),
                  newPos0 = formatPercent(scale(val)),
                  newPos1 = formatPercent(scale(val + currRange)),
                  position = (orientation === "horizontal") ? "left" : "bottom";
               value[0] = val;
               value[1] = val + currRange;
               dispatch.slide(d3.event, value );
               if (!fixedRange) {
//                  if ((currRange * ratio) < 100) {
//                     rangedisplay.text(value[0] + ' - ' + value[1]);
//                     valdisplay1.text('');
//                     valdisplay2.text('');
//                  } else {
                     valdisplay1.text(value[0]);
                     valdisplay2.text(value[1]);
                     rangedisplay.text('');
//                  }
               } else {
                  rangedisplay.text(value[0] + ' - ' + value[1]);
               }
               var width = 100 - parseFloat(newPos1);
               var top = 100 - parseFloat(newPos1);
               (position === "left") ? divRange.style("right", width + "%") : divRange.style("top", top + "%");
               (position === "left") ? divRange.style("left", newPos0) : divRange.style("bottom", newPos0);
               if (snapToTick && animate) {
                  handle1.transition()
                     .styleTween(position, function() { return d3.interpolate(oldPos0, newPos0); })
                     .duration((typeof animate === "number") ? animate : 250);
                  handle2.transition()
                     .styleTween(position, function() { return d3.interpolate(oldPos1, newPos1); })
                     .duration((typeof animate === "number") ? animate : 250);
               } else if (!fixedRange) {
                  handle1.style(position, newPos0);
                  handle2.style(position, newPos1);
               }
            } else {
               unusedDragX += deltaX;
            }
         }

         // Calculate nearest step value
         function stepValue(val) {

            if (val === scale.domain()[0] || val === scale.domain()[1]) {
               return val;
            }

            var valModStep = (val - scale.domain()[0]) % step,
               alignValue = val - valModStep;

            if (Math.abs(valModStep) * 2 >= step) {
               alignValue += (valModStep > 0) ? step : -step;
            }

            return alignValue;

         }


         function onClickHorizontal() {
            if (!value.length) {
               moveHandle(d3.event.offsetX || d3.event.layerX);
            }
         }

         function onClickVertical() {
            if (!value.length) {
               moveHandle(sliderLength - d3.event.offsetY || d3.event.layerY);
            }
         }

         function onDragHorizontal() {
            if (active == 3) {
 //              var event = d3.event.sourceEvent;
 //              var deltaX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
               var deltaX = d3.event.dx;
               if (deltaX != 0) {
                  moveRange(deltaX);
               }
            } else {
               if (active > 0) {
                  moveHandle(Math.max(0, Math.min(sliderLength, d3.event.x)));
               }
            }
         }

         function onDragVertical() {
            if ( d3.event.sourceEvent.target.id === "handle-one") {
               active = 1;
            } else if ( d3.event.sourceEvent.target.id == "handle-two" ) {
               active = 2;
            }
            moveHandle(sliderLength - Math.max(0, Math.min(sliderLength, d3.event.y)));
         }

         function stopPropagation() {
            d3.event.stopPropagation();
         }

      });

   }

   // Getter/setter functions
   slider.min = function(_) {
      if (!arguments.length) return min;
      min = _;
      return slider;
   };

   slider.max = function(_) {
      if (!arguments.length) return max;
      max = _;
      return slider;
   };

   slider.step = function(_) {
      if (!arguments.length) return step;
      step = _;
      return slider;
   };

   slider.animate = function(_) {
      if (!arguments.length) return animate;
      animate = _;
      return slider;
   };

   slider.orientation = function(_) {
      if (!arguments.length) return orientation;
      orientation = _;
      return slider;
   };

   slider.axis = function(_) {
      if (!arguments.length) return axis;
      axis = _;
      return slider;
   };

   slider.margin = function(_) {
      if (!arguments.length) return margin;
      margin = _;
      return slider;
   };

   slider.value = function(_) {
      if (!arguments.length) return value;
      value = _;
      return slider;
   };

   slider.scale = function(_) {
      if (!arguments.length) return scale;
      scale = _;
      return slider;
   };

   slider.fixedRange = function(_) {
      if (!arguments.length) return fixedRange;
      fixedRange = _;
      return slider;
   };

   d3.rebind(slider, dispatch, "on");

   return slider;

};

//(function() {
//   var moved = false;
//   var oldX, oldY = 0;
//   var ie = (function(){
//      var undef,rv = -1; // Return value assumes failure.
//      var ua = window.navigator.userAgent;
//      var msie = ua.indexOf('MSIE ');
//      var trident = ua.indexOf('Trident/');
//
//      if (msie > 0) {
//         // IE 10 or older => return version number
//         rv = parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
//      } else if (trident > 0) {
//         // IE 11 (or newer) => return version number
//         var rvNum = ua.indexOf('rv:');
//         rv = parseInt(ua.substring(rvNum + 3, ua.indexOf('.', rvNum)), 10);
//      }
//      return ((rv > -1) ? rv : undef);
//   }());
//   if (ie) {
//      if (typeof document.default_onmousemove == 'undefined') {
//         document.default_onmousemove = document.onmousemove;
//         document.onmousemove = function (e) {
//            var deltaX = e.x - oldX;
//            var deltaY = e.y - oldY;
//            oldX = e.x;
//            oldY = e.y;
//            if (!moved) {
//               moved = true;
//               deltaX = deltaY = 0;
//            }
//            e.movementX = deltaX;
//            e.movementY = deltaY;
//            if (document.default_onmousemove) {
//               document.default_onmousemove(e);
//            }
//         }
//      }
//   }
//})();
