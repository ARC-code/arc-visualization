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
            json_resources << { :name=>node['name'], :children=>[], :type=>"group"}
         else
            # recursively walk tree to find the parent resource
            parent = find_resource(:name, node['parent'], json_resources)
            parent[:children] << { :name=>node['name'], :children=>[], :type=>"group" }
         end
      end

      # Now walk the archives data and add as child to the main resource tree
      data['archives']['archive'].each do | archive |
         # recursively walk tree to find the parent resource
         parent = find_resource( :name, archive['parent'], json_resources )
         if !parent.nil?
            parent[:children]  << { :name=>archive['name'], :handle=>archive['handle'], :type=>"archive"}
         end
      end

      # at this point, there is a tree with no counts on it. Call search to
      # get the counts for all facets
      resp = RestClient.get "#{Settings.catalog_url}/search.xml"
      resp = resp.gsub(/count/, "size")
      facet_data = Hash.from_xml resp
      facet_data = facet_data['search']['facets']

      # use the name from data['archive']['facet'] to find a match in data from above
      # add size to the node data. Once complete, set data as the children of archives
      facet_data['archive']['facet'].each do |facet |
         node = find_resource( :handle, facet['name'], json_resources)
         if node.nil?
            puts "====================================> NO MATCH FOUND FOR FACET #{facet}"
         else
            node[:size] = facet['size']
         end
      end

      json_resources.each do |jr|
         if jr[:size].nil?
            total = sum_children(jr[:children])
            puts "#{jr[:name]} summed size #{total}"
            jr[:size] = total
         end
      end

      return json_resources
   end

   def self.facet(archive_handle, type, subtypes )
      # search for all  facets data for this archive
      xml_resp = RestClient.get "#{Settings.catalog_url}/search.xml?a=%2B"+archive_handle
      data = Hash.from_xml xml_resp

      # the bit we care about is in the facets and is further narrowed by type
      data = data['search']['facets'][type]

      json_resources = []
      total = 0
      if data['facet'].kind_of?(Array)
        # now, stuff this into a json datastructure for db consumption
        data['facet'].each do | facet |
           cnt = facet['count']
           total = total + cnt.to_i
           json_resources << {:name=>facet['name'], :size=>facet['count'], :type=>"subfacet"}
        end
      else
        cnt = data['facet']['count']
        total = total + cnt.to_i
        json_resources << {:name=>data['facet']['name'], :size=>cnt, :type=>"subfacet"}
      end
      #facet_json = { :name=>type, :size=>total, :children=>json_resources, :type=>"facet" }
      return json_resources
   end

   private

   def self.sum_children( children )
      sum = 0
      children.each do | child |
         if !child[:children].nil? && child[:children].length > 0
            children_sum = sum_children(child[:children])
            child[:size] = children_sum
            sum = sum + children_sum
         else
            if child[:size].nil?
               child[:size] = 0
            else
               sum = sum + child[:size].to_i
            end
         end
      end
      return sum
   end

   def self.find_resource( match_key, name, resources)
      parent = nil
      resources.each do |jr|
         if jr[match_key] == name
            parent = jr
            break
         else
            if !jr[:children].nil? && jr[:children].count > 0
               parent = find_resource(match_key, name, jr[:children])
               if !parent.nil?
                  break
               end
            end
         end
      end

      return parent
   end
end