class HomeController < ApplicationController
   def index
   end

   def get_archives
      archives = Catalog.archives
      json = { :name=>"ARC Catalog", :children=>archives, :type=>"root"}

      # detail = Catalog.facet("victbib", "genre", "all")
      # node = find(json, 'victbib')
      # node[:children] = detail
      render :json => json
   end

   # def find(node, target)
         # puts "HANDLE [#{node[:handle]}] vs #{target}"
         # if node[:handle] == target
            # puts "MATCHED============================================================="
            # return node
         # end
#
#
         # if !node[:children].nil?
            # node[:children].each do |child|
               # res = find( child, target )
               # if !res.nil?
                  # return res
               # end
            # end
         # end
         # return nil
      # end

   def get_facet_detail
      detail = Catalog.facet(params[:a], params[:f], params[:v])
      render :json => detail
   end
end
