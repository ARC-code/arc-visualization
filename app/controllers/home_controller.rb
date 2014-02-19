class HomeController < ApplicationController
   def index
   end

   def get_archives
      archives = Catalog.archives
      json = { :name=>"ARC Catalog", :children=>archives, :type=>"root"}
      render :json => json
   end

   def search
      results = Catalog.search( params[:q] )
      json = { :name=>"ARC Catalog", :children=>results, :type=>"root"}
      render :json => json
   end

   def get_facet_detail
      facets = {
         :genre => params[:g],
         :discipline => params[:d],
         :doc_type => params[:t]
      }
      puts "g=[#{params[:g]}] d=[#{params[:d]}] t=[#{params[:t]}] ======================================"
      detail = Catalog.facet(params[:a], params[:f], facets)
      render :json => detail
   end
end
