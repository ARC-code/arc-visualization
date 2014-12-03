#!/bin/bash

bundle exec unicorn_rails -c config/unicorn.rb -E production -D
ps aux | grep unicorn | grep -v grep