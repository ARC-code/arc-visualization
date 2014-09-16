#!/bin/bash

kill -s QUIT `cat /tmp/unicorn.bigdiva.pid`
bundle exec unicorn_rails -c config/unicorn.rb -E production -D

