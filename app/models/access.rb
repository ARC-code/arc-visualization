# tracks access allowed to various archive resources

class Access

  def self.load_permissions_for(ip_addr)
    config_xml = File.read(Settings.access_config_file)
    data = Hash.from_xml config_xml
    resources_hidden = []
    resources_enabled = []
    groups_hidden = []
    data['access']['config'].each do | config |
      # search the list of configs for one that matches our IP
      ip = config['ip']
      if ip === "ALL" || ip === ip_addr
        #puts "FOR #{config['name']} @#{ip}: "
        hidden = config['hidden']
        unless hidden.nil?
          resources = hidden['resource']
          if resources.is_a?(String)
            resources = [ resources ]
          end
          resources.each do | resource |
            #puts "  HIDDEN: #{resource}"
            if resource === "ALL"
              resources_hidden << "*"
            else
              resources_hidden << resource.downcase
            end
          end
        end
        hidden_groups = config['hidden_groups']
        unless hidden_groups.nil?
          groups = hidden_groups['group']
          if groups.is_a?(String)
            groups = [ groups ]
          end
          groups.each do | group |
            #puts "  GROUP HIDDEN: #{group}"
            if group === "ALL"
              groups_hidden << "*"
            else
              groups_hidden << group.downcase
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
            #puts "  ENABLED: #{resource}"
            if resource === "ALL"
              resources_enabled << "*"
            else
              resources_enabled << resource.downcase
            end
          end
        end
      end
    end
    return { :hidden => resources_hidden, :enabled => resources_enabled, :groups_hidden => groups_hidden }
  end

  def self.is_archive_group_visible?(perms, archive_group)
    return false if (archive_group != nil) && (perms[:groups_hidden].index('*') != nil) # all groups are hidden
    return false if (archive_group != nil) && (perms[:groups_hidden].index(archive_group.downcase) != nil) # this archive's group is hidden
    return true
  end

  def self.is_archive_visible?(perms, archive_handle, archive_group)
    return false unless is_archive_group_visible?(perms, archive_group)
    return false if perms[:hidden].index('*') != nil   # everything is hidden
    return false if (archive_handle != nil) && (perms[:hidden].index(archive_handle.downcase) != nil)  # specific archive is hidden
    return true   # not hidden
  end

  def self.is_archive_enabled?(perms, archive_handle, archive_group)
    return false unless is_archive_visible?(perms, archive_handle, archive_group)  # not enabled if it's hidden
    return true if perms[:enabled].index('*') != nil   # everything is enabled
    return true if (archive_handle != nil) && (perms[:enabled].index(archive_handle.downcase) != nil)  # specific archive is enabled
    return false   # not hidden, but not enabled either
  end

  def self.is_archive_searchable_for?(ip_addr, archive_handle, archive_group)
    perms = Access.load_permissions_for(ip_addr)
    # return true if archive_handle in permissions, false if not
    return Access.is_archive_enabled?(perms, archive_handle, archive_group)
  end

end