ArcVisualization::Application.routes.draw do
   root 'home#index'
   get "home/index"
   get "archives" => "home#get_archives"
   get "genres" => "home#get_genres"
   get "disciplines" => "home#get_disciplines"
   get "formats" => "home#get_formats"
   get "facet" => "home#get_facet_detail"
   get "search" => "home#search"
end
