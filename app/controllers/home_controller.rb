class HomeController < ApplicationController
   def index
   end

   def get_archives
      archives,total = Catalog.archives
      json = { :name=>"ARC Catalog", :children=>archives, :type=>"root", :size=>total}
      render :json => json
   end

   def get_genres
     genres, total = Catalog.genres
     json = { :name=>"ARC Catalog", :children=>genres, :type=>"root", :size=>total}
     render :json => json
   end

   def get_disciplines
     disciplines, total = Catalog.disciplines
     json = { :name=>"ARC Catalog", :children=>disciplines, :type=>"root", :size=>total}
     render :json => json
   end

   def get_formats
     formats, total = Catalog.formats
     json = { :name=>"ARC Catalog", :children=>formats, :type=>"root", :size=>total}
     render :json => json
   end

   def search
      results,total = Catalog.search( params[:q], params[:y] )
      json = { :name=>"ARC Catalog", :children=>results, :type=>"root", :size=>total}
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
