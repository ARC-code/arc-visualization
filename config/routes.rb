ArcVisualization::Application.routes.draw do
   root 'home#index'
   get "home/index"
   get "archives" => "home#get_archives"
   get "genres" => "home#get_genres"
   get "disciplines" => "home#get_disciplines"
   get "formats" => "home#get_formats"
   get "facet" => "home#get_facet_detail"
   get "search_archives" => "home#search_archives"
   get "search_genres" => "home#search_genres"
   get "search_formats" => "home#search_formats"
   get "search_disciplines" => "home#search_disciplines"
end
