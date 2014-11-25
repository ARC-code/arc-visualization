class HomeController < ApplicationController
   def index
   end

   def get_archives
      archives,total = Catalog.archives(request.remote_ip, params[:p])
      json = { :name=>"ARC Catalog", :children=>archives, :type=>"root", :size=>total}
      render :json => json
   end

   def get_genres
     genres, total = Catalog.genres(request.remote_ip, params[:p])
     json = { :name=>"ARC Catalog", :children=>genres, :type=>"root", :size=>total}
     render :json => json
   end

   def get_disciplines
     disciplines, total = Catalog.disciplines(request.remote_ip, params[:p])
     json = { :name=>"ARC Catalog", :children=>disciplines, :type=>"root", :size=>total}
     render :json => json
   end

   def get_formats
     formats, total = Catalog.formats(request.remote_ip, params[:p])
     json = { :name=>"ARC Catalog", :children=>formats, :type=>"root", :size=>total}
     render :json => json
   end

   def search_archives
      results,total = Catalog.search_archives(request.remote_ip,  params[:q], params[:y], params[:p] )
      json = { :name=>"ARC Catalog", :children=>results, :type=>"root", :size=>total}
      render :json => json
   end

   def search_genres
     results,total = Catalog.search_genres(request.remote_ip,  params[:q], params[:y], params[:p] )
     json = { :name=>"ARC Catalog", :children=>results, :type=>"root", :size=>total}
     render :json => json
   end

   def search_disciplines
     results,total = Catalog.search_disciplines(request.remote_ip,  params[:q], params[:y], params[:p] )
     json = { :name=>"ARC Catalog", :children=>results, :type=>"root", :size=>total}
     render :json => json
   end

   def search_formats
     results,total = Catalog.search_formats(request.remote_ip,  params[:q], params[:y], params[:p] )
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
      detail = Catalog.facet(request.remote_ip, params[:f], facets, params[:q], params[:y], params[:p])
      render :json => detail
   end

   def get_results_detail
     facets = {
         :genre => params[:g],
         :discipline => params[:d],
         :doc_type => params[:t],
         :archive => params[:a]
     }
     detail = Catalog.results(request.remote_ip, facets, params[:q], params[:y], params[:pg])
     render :json => detail
   end
end
