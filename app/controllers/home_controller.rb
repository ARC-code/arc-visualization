class HomeController < ApplicationController
   def index
   end

   def get_archives
      archives,total = Catalog.archives(params[:p])
      json = { :name=>"ARC Catalog", :children=>archives, :type=>"root", :size=>total}
      render :json => json
   end

   def get_genres
     genres, total = Catalog.genres(params[:p])
     json = { :name=>"ARC Catalog", :children=>genres, :type=>"root", :size=>total}
     render :json => json
   end

   def get_disciplines
     disciplines, total = Catalog.disciplines(params[:p])
     json = { :name=>"ARC Catalog", :children=>disciplines, :type=>"root", :size=>total}
     render :json => json
   end

   def get_formats
     formats, total = Catalog.formats(params[:p])
     json = { :name=>"ARC Catalog", :children=>formats, :type=>"root", :size=>total}
     render :json => json
   end

   def search_archives
      results,total = Catalog.search_archives( params[:q], params[:y], params[:p] )
      json = { :name=>"ARC Catalog", :children=>results, :type=>"root", :size=>total}
      render :json => json
   end

   def search_genres
     results,total = Catalog.search_genres( params[:q], params[:y], params[:p] )
     json = { :name=>"ARC Catalog", :children=>results, :type=>"root", :size=>total}
     render :json => json
   end

   def search_disciplines
     results,total = Catalog.search_disciplines( params[:q], params[:y], params[:p] )
     json = { :name=>"ARC Catalog", :children=>results, :type=>"root", :size=>total}
     render :json => json
   end

   def search_formats
     results,total = Catalog.search_formats( params[:q], params[:y], params[:p] )
     json = { :name=>"ARC Catalog", :children=>results, :type=>"root", :size=>total}
     render :json => json
   end

   def get_facet_detail
      facets = {
         :genre => params[:g],
         :discipline => params[:d],
         :doc_type => params[:t],
         :archive => params[:a]
      }
      detail = Catalog.facet(params[:f], facets, params[:q], params[:y], params[:p])
      render :json => detail
   end
end
