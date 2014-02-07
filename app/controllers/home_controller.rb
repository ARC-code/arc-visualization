class HomeController < ApplicationController
  def index
  end

  def get_archives
     archives = Catalog.archives
     json = { :name=>"ARC Catalog", :children=>archives}
     render :json => json
  end
end
