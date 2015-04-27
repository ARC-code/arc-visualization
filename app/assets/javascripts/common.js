
/**
 * GLOBALS ):
 */
var filter = {
    searchQuery: "",
    date: ""
};
var gYearRangeStart = 0;
var gYearRangeEnd = 0;
var gActiveTimeline = false;
/**
 * END globals ------------------------------------------------------------------
 */

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
   if (!handle && d.archive_handle) {
      handle = d.archive_handle;
   }

   // build the query string
   var params = "";
   var paramsArray = [];
   if (handle) {
      paramsArray.push("a=" + handle);
   }
   if (d.facet === "archive" || d.type == "type") {
      paramsArray.push("a=" + d.name);
   }
   if (d.facet === "genre" || d.type == "genre") {
      paramsArray.push("g=" + d.name);
   }
   if (d.facet === "discipline" || d.type == "discipline") {
      paramsArray.push("d=" + d.name);
   }
   if (d.facet === "doc_type" || d.type == "format") {
      paramsArray.push("t=" + d.name);
   }
   if (d.other_facets) {
      if (d.other_facets.genre) {
         var genre = d.other_facets.genre.replace(/\+/g, "");
         paramsArray.push("g=" + genre);
      }
      if (d.other_facets.discipline) {
         var discipline = d.other_facets.discipline.replace(/\+/g, "");
         paramsArray.push("d=" + discipline);
      }
      if (d.other_facets.doc_type) {
         var doc_type = d.other_facets.doc_type.replace(/\+/g, "");
         paramsArray.push("t=" + doc_type);
      }
      if (d.other_facets.archive) {
         var archive = d.other_facets.archive.replace(/\+/g, "");
         paramsArray.push("a=" + archive);
      }
   }

   params = paramsArray.join("&");
   if (params.length > 0) {
      params = "&" + params;
      params = params.replace(/\s/g, "+");
   }
   return params;
};


function getSearchParams(prepend, includeDate ) {
   var params = [];
   if (filter.searchQuery.length > 0) {
      params.push(filter.searchQuery);
   }

   if (includeDate == true ) {
      if (gYearRangeStart && gYearRangeEnd) {
         params.push("y=%2b" + make4digitYear(gYearRangeStart) + "+TO+"
               + make4digitYear(gYearRangeEnd));
      }
      if (filter.date.length > 0) {
         params.push(filter.date);
      }
   }

   var p = params.join("&");
   if (p.length > 0) {
      return prepend + p;
   }
   return "";
}
