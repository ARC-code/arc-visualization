/**
 * Get list of results for sidebar
 */
var getSidebarResults = function(node) {
   $("#sidebar").data("node", node);
   if ($("#not-subscriber-msg").is(":visible")) {
      var right = parseInt($("#sidebar").css("right"), 10);
      if (right == 0) {
         right *= -1;
         $("#sidebar").animate({
            right : "-=226",
         }, 150);
      }
      return;
   }
   var listPageSize = 10;
   var query = "/search?";
   var params = getFacetParams(node);
   listPage = node.listPage;
   if (!listPage) {
      node.listPage = 0;
      listPage = 0;
   }
   if (listPage > 0) {
      params += "&pg=" + listPage;
   }
   params += "&max=10&sidebar=1";
   $("#sidebar .title").text(node.name);

   $("#sidebar #content").empty();
   $("#list-page-ctls .total").text(node.size);

   // page counts
   var numPages = Math.floor((node.size + 9) / 10);
   $("#list-page-ctls .page-count").text((listPage + 1) + " of " + numPages);
   $(".page-nav.prev").show();
   $(".page-nav.next").show();
   if (0 == listPage)
      $(".page-nav.prev").hide();
   if (numPages == (listPage + 1))
      $(".page-nav.next").hide();

   // append the query/date stuff (true causes date param to be added)
   params = params + getSearchParams("&", true);

   $.getJSON(query + params, function(data, textStatus, jqXHR) {
      if (textStatus !== "success") {
         return;
      }

      $("#sidebar #content").html(data.html);
      
      // first data view shows sidebar. thereafter it remains as set
      if ( $("#sidebar").hasClass("init")) {
         $("#sidebar").removeClass("init");
         var right = parseInt($("#sidebar").css("right"), 10);
         if (right < 0) {
            right *= -1;
            $("#sidebar").animate({
               right : "+=" + right,
            }, 150, function() {
               $("#toggle-sidebar").removeClass("open");
            });
         }
      }

   });
}

var highlightResults = function(node, json) {
   $(".on-graph").removeClass("on-graph");
   $("#sidebar .hit").each( function() {
      var hit = $(this);
      $.each(json, function(idx,val) {
         if ( hit.data("uri") == val["uri"] ) {
            hit.addClass("on-graph");
         }
      })
   });
}

var toggleSidebar = function() {
   var toggle = $("#toggle-sidebar");
   if (toggle.hasClass("open")) {
      var right = parseInt($("#sidebar").css("right"), 10);
      if (right < 0) {
         right *= -1;
         $("#sidebar").animate({
            right : "+=" + right,
         }, 150, function() {
            $("#toggle-sidebar").removeClass("open");
         });
      }
   } else {
      hideSidebar();
   }
}

var prevPageClicked = function() {
   var node = $("#sidebar").data("node");
   node.listPage = node.listPage - 1;
   getSidebarResults(node);
}
var nextPageClicked = function() {
   var node = $("#sidebar").data("node");
   node.listPage = node.listPage + 1;
   getSidebarResults(node);
}

var hideSidebar = function() {
   var right = parseInt($("#sidebar").css("right"), 10);
   if (right == 0) {
      $("#sidebar").animate({
         right : "-=226",
      }, 150, function() {
         $("#toggle-sidebar").addClass("open");
      });
   }
}