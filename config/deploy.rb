require "rvm/capistrano"
require 'bundler/capistrano'


#before 'deploy', 'rvm:install_rvm'  # install/update RVM
#before 'deploy', 'rvm:install_ruby' # install Ruby and create gemset (both if missing)

set :default_shell, "/bin/bash -l"

set :application, "arc-visualization"
set :scm, "git"
set :branch, "master"
set :repository,  "git@github.com:performant-software/arc-visualization.git"

set :user, "juxta"
set :group, "juxta"
set :use_sudo, false

role :web, "juxta-staging.performantsoftware.com"                          # Your HTTP server, Apache/etc
role :app, "juxta-staging.performantsoftware.com"                          # This may be the same as your `Web` server
role :db,  "juxta-staging.performantsoftware.com", :primary => true # This is where Rails migrations will run

set :rails_env, "production"
#set :rvm_type, :system
#set :rvm_ruby_string, "ruby-2.0.0-p247"
set :rvm_ruby_string, "ruby-2.1.5"
set :deploy_via, :remote_cache
set :keep_releases, 5
set :normalize_asset_timestamps, false

set :deploy_to, "/home/juxta/www/arc-visualization"

namespace :deploy do
   desc "Start unicorn"
   task :start, :except => { :no_release => true } do
      run "cd #{current_path} ; bundle exec unicorn -c config/unicorn.rb  -E production -D"
   end

   desc "Stop unicorn"
   task :stop, :except => { :no_release => true } do
      run "kill -s QUIT `cat /tmp/unicorn.bigdiva.pid`"
   end

   desc "RE-Start unicorn"
   task :restart, :except => { :no_release => true } do
      run "kill -s QUIT `cat /tmp/unicorn.bigdiva.pid`"
      run "cd #{current_path} ; bundle exec unicorn -c config/unicorn.rb -E production -D"
   end
end

namespace :config do
  desc "Config Symlinks"
  task :symlinks do
    run "ln -nfs #{shared_path}/site.yml #{release_path}/config/site.yml"
  end
end

after "deploy:finalize_update", "config:symlinks"

namespace :deploy do
   desc "Override deploy:cold to NOT run migrations - there's no database"
   task :cold do
      update
      start
   end
end

