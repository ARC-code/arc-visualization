# Load the Rails application.
require File.expand_path('../application', __FILE__)

# If availble, load site specific settings from yml file.
CONFIG_FILE = "#{Rails.root}/config/site.yml"
if File.exists?(CONFIG_FILE)
  class Settings < Settingslogic
     source CONFIG_FILE
     namespace Rails.env
     suppress_errors Rails.env.test?
     load!
   end
else
   # No yml, initialize the settings class from ENV
   class Settings
      def self.catalog_url
        return ENV["CATALOG_URL"]
      end
   end
end

# Initialize the Rails application.
ArcVisualization::Application.initialize!
