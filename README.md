ARC Catalog Visualization (prototype)
=====================================

# BigDIVA Documentation

## Install Instructions

These instructions are written for CentOS 6 & 7, but should work on most modern Linux systems.


1. As root, create user account to run BigDIVA

    [root@(host) root]# useradd bigdiva    
    [root@(host) root]# passwd bigdiva

        Changing password for user bigdiva.
        New password:          
            (set the bigdiva user password as desired)
        Retype new password:   
            (repeat it)
        passwd: all authentication tokens updated successfully.

    [root@(host) root]# su - bigdiva
    [bigdiva@(host) ~]$


2. As bigdiva user, install RVM

    [bigdiva@(host) ~]$ curl -sSL https://get.rvm.io | bash

        Downloading https://github.com/wayneeseguin/rvm/archive/master.tar.gz

        Installing RVM to /home/bigdiva/.rvm/
            Adding rvm PATH line to /home/bigdiva/.profile /home/bigdiva/.mkshrc /home/bigdiva/.bashrc /home/bigdiva/.zshrc.
            Adding rvm loading line to /home/bigdiva/.profile /home/bigdiva/.bash_profile /home/bigdiva/.zlogin.
        Installation of RVM in /home/bigdiva/.rvm/ is almost complete:

          * To start using RVM you need to run `source /home/bigdiva/.rvm/scripts/rvm`
            in all your open shell windows, in rare cases you need to reopen all shell windows.

    [bigdiva@(host) ~]$ source /home/bigdiva/.rvm/scripts/rvm


3. Generate ssh key for public key access to github repository

    [bigdiva@(host) ~]$ ssh-keygen

        Generating public/private rsa key pair.
        Enter file in which to save the key (/home/bigdiva/.ssh/id_rsa):  
            (hit enter to accept default)
        Enter passphrase (empty for no passphrase):   
            (hit enter to not use a passphrase)
        Enter same passphrase again:                  
            (hit enter again)
        Your identification has been saved in /home/bigdiva/.ssh/id_rsa.
        Your public key has been saved in /home/bigdiva/.ssh/id_rsa.pub.

    [bigdiva@(host) ~]$ cat .ssh/id_rsa.pub

        ssh-rsa (your ssh public key) bigdiva@(host)

    Copy the output of the cat command, including the "ssh-rsa" prefix and the "bigdiva@(host)"
    suffix and go to <https://github.com/settings/ssh>. Click the <Add SSH key> button at the
    top of the page. Title it "bigdiva@(whatever the hostname is)" and paste the output of the
    cat command into the Key section. Click <Add Key>. The bigdiva user will now be able access
    the github project via your account for checkout.


4. Install the code using github checkout

    [bigdiva@(host) ~]$ git clone git@github.com:performant-software/arc-visualization.git

        Initialized empty Git repository in /home/bigdiva/arc-visualization/.git/


5. Install Ruby using RVM

    $ cd /home/bigdiva/arc-visualization/
    $ rvm install ruby-2.1.0

    NOTE: this can take a while if it has to compile it.


6. Install needed Ruby Gems

    $ bundle update


7. Copy and edit the site.yml file to match the configuration of your system

    $ cp -f config/site.yml.example config/site.yml
    $ vi config/site.yml

    NOTE: for production, the values should be:
        catalog_url: http://catalog.ar-c.org
        access_config_file: /home/bigdiva/arc-visualization/config/bigdiva_access.xml


8. Edit the unicorn.rb file to set the correct location for the log files

    $ vi config/unicorn.rb

    Change the line:

        shared_path = "/home/juxta/www/arc-visualization/shared"

    To:

        shared_path = "/home/bigdiva/arc-visualization/log"

9. Copy bigdiva_access.xml

    `$cp -f config/bigdiva_access.example.xml config/bigdiva_access.xml`


9. Install Node.js

    Install from EPEL Repository:
      [bigdiva@(host) ~]$ sudo yum install epel-release
      [bigdiva@(host) ~]$ sudo yum install nodejs

      Check that it was successful with
          [bigdiva@(host) ~]$ node --version


10. Precompile all the assets

    $ rake assets:precompile


11. Open a port in the firewall

    To open up a new port (e.g., TCP/80) permanently, use these commands.

    [bigdiva@(host) ~]$ sudo firewall-cmd --zone=public --add-port=80/tcp --permanent
    [bigdiva@(host) ~]$ sudo firewall-cmd --reload


12. Start the rails app
      [bigdiva@(host) ~]$ unicorn_rails -(host) -p 80

      -o sets the host, -p sets the port


13. Test from a browser to make sure it's working.

    If anything goes wrong, look at the unicorn logs (in /home/bigdiva/arc-visualization/log/),
    and the production log (also in /home/bigdiva/arc-visualization/log/).



## Update bigdiva_access.xml or en.yml
The access file is to update the IPs to give access to new users/campuses.
The en.yml file is to alter the machine name of each archive to a more human readable name.

To update bigdiva_access.xml

$ ssh to server with BigDIVA installed
the bigdiva_access.xml will most likely be in /home/bigdiva/config

nano bigdiva_access.xml

make changes

^X and Y for save


To update en.yml

$ ssh to server with BigDIVA installed

nano en.yml

make changes

^X and Y for save

follow restart BigDiva instructions to enact changes


## Use Custom Colors for bubbles
To change the colors of the bubbles for Resource, Genre, Discipline, or Format:

1. Edit public/mycolors.json
    The colors are sorted by visualization type.
    They are numbered 1 - 5 in order of shade.

    A guide on how the colors are used:
      1 - used for the selected bubble highlight
      2 - used for the collapsed bubble color
      3 - used for the fixed bubble highlight
      4 - used for the normal bubble highlight AND the selected bubble color
      5 - used for the normal bubble color AND the collapsed bubble highlight AND the fixed bubble color.

2. Edit /app/assets/stylesheets/home.css.scss
    Lines 11-14 are the values for each of the visualization types.
    It is recommended that the color used here is the color used for the number 5 variable in mycolors.json
       (So to edit `$discipline-custom`, use the value of `discipline5` from mycolors.json)

3. Save both files.
    No restart necessary, just reload the page after having saved both files.


Below Here Unknown
==================



##How to Update BigDIVA on Staging or Production from GitHub

1. ssh to the server:

2. Become the juxta user
    $ sudo -u juxta -s   

3. Pull the latest from GitHub and precompile the assets
    $ git pull
    $ rake assets:precompile

4. Restart the server (see below)

5. Check in a web browser that everything is working correctly.



##How to Restart BigDIVA on Staging or Production
STAGING:

1. Login to the server:

    $ ssh to server with BigDIVA installed

2. Become the juxta user

    $ sudo -u juxta -s

3. Change to the BigDIVA install location

    $ cd /home/juxta/www/arc-visualization/current

4. Stop it, and wait for all processes to exit.

    $ ./stop.sh

    This will start to shut down the server and show the list of processes that are running.
    Here it is shown with all processes still active.

        Every 2.0s: ps aux | grep unicorn | grep -v grep                                                                                                                                   Thu Dec 11 13:37:38 2014

        juxta     2249  0.0  0.4 348156  4916 ?        Sl   10:07   0:02 unicorn_rails master -c config/unicorn.rb -E production -D
        juxta     2255  0.9 16.9 593368 172156 ?       Sl   10:07   1:53 unicorn_rails worker[1] -c config/unicorn.rb -E production -D
        juxta     5374  0.3 18.4 504176 188100 ?       Sl   11:15   0:30 unicorn_rails worker[3] -c config/unicorn.rb -E production -D
        juxta     5377  0.1  7.6 458916 77468 ?        Sl   11:15   0:11 unicorn_rails worker[2] -c config/unicorn.rb -E production -D
        juxta     8806  0.0  6.9 353188 71112 ?        Sl   12:06   0:00 unicorn_rails worker[0] -c config/unicorn.rb -E production -D

    Here it is when all processes are done. It's possible that it will start out this way,
    if the server wasn't running at all for some reason. Otherwise, it can sometimes take
    a few minutes for all processes to exit.

        Every 2.0s: ps aux | grep unicorn | grep -v grep                                                                                                                                   Thu Dec 11 13:37:38 2014

        (rest of the screen is blank)

    Hit control-C to exit when all processes are done.

5. Start it up clean

    $ ./start.sh

    After a minute, it will show the list of running processes, which will let you know that
    it worked.

        juxta     2249  0.0  0.4 348156  4888 ?        Sl   10:07   0:02 unicorn_rails master -c config/unicorn.rb -E production -D                                                                                              
        juxta     2255  0.8 16.2 593368 165488 ?       Sl   10:07   1:53 unicorn_rails worker[1] -c config/unicorn.rb -E production -D                                                                                           
        juxta     5374  0.3 18.3 504308 186676 ?       Sl   11:15   0:30 unicorn_rails worker[3] -c config/unicorn.rb -E production -D                                                                                           
        juxta     5377  0.1  7.7 459756 78668 ?        Sl   11:15   0:11 unicorn_rails worker[2] -c config/unicorn.rb -E production -D                                                                                           
        juxta     8806  0.0  6.9 353456 70712 ?        Sl   12:06   0:00 unicorn_rails worker[0] -c config/unicorn.rb -E production -D                                                                             



******************************************************************************************
##Troublshooting

###If the server is acting up (processes won't kill) try the below

First, use check.sh to see what is actually running:

[juxta@juxta-staging current]$ ./check.sh
juxta     1611  0.2 28.1 586196 286300 ?       Sl   Jan05   0:32 unicorn_rails worker[3] -c config/unicorn.rb -E production -D                                                                                          
juxta     1797  0.0  2.9 353536 30172 ?        Sl    2014   0:11 unicorn_rails master -c config/unicorn.rb -E production -D                                                                                              
juxta     8146  0.6  3.8 604032 39184 ?        Sl   Jan05   0:39 unicorn_rails worker[1] -c config/unicorn.rb -E production -D                                                                                          
juxta    10620  0.6 21.1 588076 214964 ?       Sl   Jan05   0:31 unicorn_rails worker[0] -c config/unicorn.rb -E production -D                                                                                          
juxta    19183  0.1  5.8 353536 59604 ?        Sl   00:31   0:00 unicorn_rails worker[2] -c config/unicorn.rb -E production -D                                            

Notice in the list about there is one that says “unicorn_rails master”, whereas the rest are workers. Make a note of the number in the second column (in this case 1797). That’s the process id (pid). Pass that to the kill command as follows:                                                               

[juxta@juxta-staging current]$ kill 1797

From there, just do the check script every few seconds to see when it is all shut down. At that point you can to the start.sh script to get it going again.

AND

And if for some reason kill doesn’t work, use kill -9 {pid}. Kill without any parameters lets the app try to shut itself down gracefully. Kill -9 is a forceful shutdown by the OS that the app can’t avoid.


###Is BigDIVA taking a while to load? Are you getting notifications of low memory from the server (edge or production)?

1. Login to the ARC server in question (dh-arc-production or dh-arc-staging)
2. cd www/catalog/current
3. run the command "top" and hit O (capital O), which will bring up a sort list
4. hit n (lowercase n), which will specify by %mem
    Output will look like this:
  PID USER      PR  NI  VIRT  RES  SHR S %CPU %MEM    TIME+  COMMAND
11579 arc       20   0 5813m
5.3g
 2456 S  0.0 34.3  39:38.83 ruby
16130 arc       20   0 48.0g
4.2g
 3720 S  0.3 26.7   1617:39 java
    The bold items are actual space in RAM.  The PID of that ruby process is 11579.
5. run "ps u [pid]" and output will look like this:
$ ps u 11579
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
arc      11579  4.3 34.2 5952604 5594300 ?     Sl   03:37  39:40 Passenger RackApp: /var/www/arc/catalog/current  
6. Contact sysadmin is the memory used exceeds the actual space in RAM.
