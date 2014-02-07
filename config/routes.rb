ArcVisualization::Application.routes.draw do
  root 'home#index'
  get "home/index"
  get "archives" => "home#get_archives"
end
