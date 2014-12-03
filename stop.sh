#!/bin/bash

kill -s QUIT `cat /tmp/unicorn.bigdiva.pid`
watch "ps aux | grep unicorn"
