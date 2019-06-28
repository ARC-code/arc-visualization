class HomeController < ApplicationController
   def index
     @debugMode = (request.remote_ip == '127.0.0.1')
     @do_not_show_intro = cookies[:big_diva_intro_skip]
     default_render
   end

   def get_archives
      puts 'IP:'
      puts request.headers['HTTP_X_FORWARD_FOR']
      archives,total = Catalog.archives(request.headers['HTTP_X_FORWARD_FOR'], params[:p])
      json = { :name=>"ARC Catalog", :children=>archives, :type=>"root", :size=>total}
      render :json => json
   end

   def get_genres
     genres, total = Catalog.genres(request.headers['HTTP_X_FORWARD_FOR'], params[:p])
     json = { :name=>"ARC Catalog", :children=>genres, :type=>"root", :size=>total}
     render :json => json
   end

   def get_disciplines
     disciplines, total = Catalog.disciplines(request.headers['HTTP_X_FORWARD_FOR'], params[:p])
     json = { :name=>"ARC Catalog", :children=>disciplines, :type=>"root", :size=>total}
     render :json => json
   end

   def get_formats
     formats, total = Catalog.formats(request.headers['HTTP_X_FORWARD_FOR'], params[:p])
     json = { :name=>"ARC Catalog", :children=>formats, :type=>"root", :size=>total}
     render :json => json
   end

   def search_archives
      results,total = Catalog.search_archives(request.headers['HTTP_X_FORWARD_FOR'],  params[:q], params[:y], params[:p] )
      json = { :name=>"ARC Catalog", :children=>results, :type=>"root", :size=>total}
      render :json => json
   end

   def search_genres
     results,total = Catalog.search_genres(request.headers['HTTP_X_FORWARD_FOR'],  params[:q], params[:y], params[:p] )
     json = { :name=>"ARC Catalog", :children=>results, :type=>"root", :size=>total}
     render :json => json
   end

   def search_disciplines
     results,total = Catalog.search_disciplines(request.headers['HTTP_X_FORWARD_FOR'],  params[:q], params[:y], params[:p] )
     json = { :name=>"ARC Catalog", :children=>results, :type=>"root", :size=>total}
     render :json => json
   end

   def search_formats
     results,total = Catalog.search_formats(request.headers['HTTP_X_FORWARD_FOR'],  params[:q], params[:y], params[:p] )
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
      detail = Catalog.facet(request.headers['HTTP_X_FORWARD_FOR'], params[:f], facets, params[:q], params[:y], params[:p])
      render :json => detail
   end

   def get_results_detail
     facets = {
         :genre => params[:g],
         :discipline => params[:d],
         :doc_type => params[:t],
         :archive => params[:a]
     }
     max = params[:max]
     max = 5 if max.nil?
     pg = params[:pg]
     pg = 0 if pg.nil?
      
     detail = Catalog.results(request.headers['HTTP_X_FORWARD_FOR'], facets, params[:q], params[:y], pg, max)
     if params[:sidebar]
        puts "RESP #{detail}"
        html = render_to_string( :partial => 'hits', :layout => false, :locals=>{:hits=>detail} )
        render :json => {:html=>html}
     else
        render :json => detail
     end
   end
end
