# tracks access allowed to various archive resources

class Access

  def self.load_permissions_for(ip_addr)
    config_xml = File.read(Settings.access_config_file)
    data = Hash.from_xml config_xml
    resources_hidden = []
    resources_enabled = []
    data['access']['config'].each do | config |
      # search the list of configs for one that matches our IP
      ip = config['ip']
      if ip === "ALL" || ip === ip_addr
        hidden = config['hidden']
        unless hidden.nil?
          resources = hidden['resource']
          if resources.is_a?(String)
            resources = [ resources ]
          end
          resources.each do | resource |
            puts "HIDDEN: #{resource}"
            if resource === "ALL"
              resources_hidden << "*"
            else
              resources_hidden << resource
            end
          end
        end
        enabled = config['enabled']
        unless enabled.nil?
          resources = enabled['resource']
          if resources.is_a?(String)
            resources = [ resources ]
          end
          resources.each do | resource |
            puts "ENABLED: #{resource}"
            if resource === "ALL"
              resources_enabled << "*"
            else
              resources_enabled << resource
            end
          end
        end
      end
    end
    return { :hidden => resources_hidden, :enabled => resources_enabled }
  end

  def self.is_archive_visible?(perms, archive_handle)
    return false if perms[:hidden].index('*') != nil   # everything is hidden
    return false if perms[:hidden].index(archive_handle) != nil  # specific archive is hidden
    return true   # not hidden
  end

  def self.is_archive_enabled?(perms, archive_handle)
    return false if perms[:hidden].index('*') != nil   # everything is hidden
    return false if perms[:hidden].index(archive_handle) != nil  # specific archive is hidden
    return true if perms[:enabled].index('*') != nil   # everything is enabled
    return true if perms[:hidden].index(archive_handle) != nil  # specific archive is enabled
    return false   # not hidden, but not enabled either
  end

  def self.is_archive_searchable_for?(ip_addr, archive_handle)
    perms = Access.load_permissions_for(ip_addr)
    # return true if archive_handle in permissions, false if not
    return Access.is_archive_enabled?(perms, archive_handle)
  end

end