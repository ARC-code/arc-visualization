#!/bin/bash

[[ -s "$HOME/.rvm/scripts/rvm" ]] && source "$HOME/.rvm/scripts/rvm" # Load RVM into a shell session *as a function*
bundle exec unicorn_rails -c config/unicorn.rb -E production -D
ps aux | grep unicorn | grep -v grep