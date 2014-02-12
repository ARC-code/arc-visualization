class HomeController < ApplicationController
   def index
   end

   def get_archives
      archives = Catalog.archives
      json = { :name=>"ARC Catalog", :children=>archives, :type=>"root"}
      render :json => json
   end

   def get_facet_detail
      detail = Catalog.facet(params[:a], params[:f], params[:v])
      render :json => detail
   end
end
