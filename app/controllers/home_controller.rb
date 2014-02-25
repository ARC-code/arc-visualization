class HomeController < ApplicationController
   def index
   end

   def get_archives
      archives,total = Catalog.archives
      json = { :name=>"ARC Catalog", :children=>archives, :type=>"root", :size=>total}
      render :json => json
   end

   def search
      results = Catalog.search( params[:q], params[:y] )
      json = { :name=>"ARC Catalog", :children=>results, :type=>"root"}
      render :json => json
   end

   def get_facet_detail
      facets = {
         :genre => params[:g],
         :discipline => params[:d],
         :doc_type => params[:t]
      }
      detail = Catalog.facet(params[:a], params[:f], facets, params[:q], params[:y])
      render :json => detail
   end
end
