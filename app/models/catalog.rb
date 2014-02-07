require 'rest_client'

class Catalog
   # get an xml report of the archives. This has 2 key parts -
   #    resource_tree.nodes
   #    resource_tree.archives.
   #
   # nodes has a list of node elements. Each has a name and may also have parent.
   # This defines the high level heirarchy
   #
   # archives has a list of archive elements. Each has a name, parent and handle.
   # Parent slots it under a node from above, and handle is used to match up facet results
   # from the next query
   #
   def self.archives
      # get the data from the catalog. All catalog response are in XML
      xml_resp = RestClient.get "#{Settings.catalog_url}/archives.xml"

      # stuff xml into has and prune it to resource tree
      data = Hash.from_xml xml_resp
      data = data['resource_tree']

      # convert nasty XML into something useful by D3; first walk the nodes to
      # build the high level heirarchy
      json_resources = []
      data['nodes']['node'].each do | node |
         # if node is top-level, it will not have a parent attrib (grr)
         if node['parent'].nil?
            puts "TOP LEVEL: #{node['name']}"
            json_resources << { :name=>node['name'], :children=>[]}
         else
            # recursively walk tree to find the parent resource
            puts "FIND PARENT #{node['parent']}..."
            if node['parent'] == 'New York Public Library'
               puts 'evil'
            end
            parent = find_resource(node['parent'], json_resources)
            puts "   PARENT #{parent['name']} CHILD #{node['name']}"
            parent[:children] << { :name=>node['name'], :children=>[]}
         end
      end

      # Now walk the archives data and add as child to the main resource tree
      data['archives']['archive'].each do | archive |
         # recursively walk tree to find the parent resource
         parent = find_resource( archive['parent'], json_resources )
         parent[:children]  << { :name=>archive['name'], :handle=>archive['handle']}
      end

      return json_resources
   end

   private

   def self.find_resource( name, resources)
      parent = nil
      resources.each do |jr|
         if jr[:name] == name
            puts "FOUND PARENT #{jr[:name]}"
            parent = jr
            break
         else
            if !jr[:children].nil? && jr[:children].count > 0
               parent = find_resource(name, jr[:children])
               if !parent.nil?
                  break
               end
            end
         end
      end

      puts "RETURNING PARENT #{parent}"
      return parent
   end
end