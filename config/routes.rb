ArcVisualization::Application.routes.draw do
   root 'home#index'
   get "home/index"
   get "archives" => "home#get_archives"
   get "facet" => "home#get_facet_detail"
end
