require 'rest_client'

class Catalog
   # get an xml report of the archives. This has 2 key parts -
   #    resource_tree.nodes
   #    resource_tree.archives.
   #
   # nodes has a list of node elements. Each has a name and may also have parent.
   # This defines the high level hierarchy
   #
   # archives has a list of archive elements. Each has a name, parent and handle.
   # Parent slots it under a node from above, and handle is used to match up facet results
   # from the next query
   #
   def self.archives

      # first, get the resource tree
      json_resources = get_resource_tree()

      # at this point, there is a tree with no counts on it. Call search to
      # get the counts for all facets
      return do_search(:archives, json_resources, nil, nil)
   end

   # get an xml report of the genres
   def self.genres
     # first, get the list of genres
     json_resources = get_genres()
     # at this point, there is a list with no counts on it. Call search to
     # get the counts for all facets
     return do_search(:genres, json_resources, nil, nil)
   end

   def self.disciplines
     # first, get the list of disciplines
     json_resources = get_disciplines()
     # at this point, there is a list with no counts on it. Call search to
     # get the counts for all facets
     return do_search(:disciplines, json_resources, nil, nil)
   end

   def self.formats
     # first, get the list of formats
     json_resources = get_formats()
     # at this point, there is a list with no counts on it. Call search to
     # get the counts for all facets
     return do_search(:formats, json_resources, nil, nil)
   end


   def self.search( query, dates )
      # first, get the resource tree
      json_resources = get_resource_tree()

      # at this point, there is a tree with no counts on it. Call search to
      # get the counts for all facets
      return do_search(:archives, json_resources, query, dates)
   end

   def self.facet(target_type, prior_facets, searchTerms, dates )
      facet_name=target_type

      min_year = 400
      max_year = 2100

      # search for all  facets data for this archive
      query = "#{Settings.catalog_url}/search.xml?max=0&facet=#{facet_name}&period_pivot=#{facet_name}"
      archive_handle = prior_facets[:archive] if !prior_facets[:archive].nil?
#      query << "a=%2B"+archive_handle if !archive_handle.nil?
      query << "&q=#{CGI.escape(searchTerms)}" if !searchTerms.nil?
      query << "&y=#{CGI.escape(dates)}" if !dates.nil?
      facets = []
      facets << "a=%2B#{CGI.escape(prior_facets[:archive])}" if !prior_facets[:archive].nil?
      facets << "g=%2B#{CGI.escape(prior_facets[:genre])}" if !prior_facets[:genre].nil?
      facets << "discipline=%2B#{CGI.escape(prior_facets[:discipline])}" if !prior_facets[:discipline].nil?
      facets << "doc_type=%2B#{CGI.escape(prior_facets[:doc_type])}" if !prior_facets[:doc_type].nil?
      facet_params = facets.join("&")
      facet_params = "&#{facet_params}" if !facet_params.empty?
      puts "QUERY: #{query}#{facet_params}"
      xml_resp = RestClient.get "#{query}#{facet_params}"
      data = Hash.from_xml xml_resp

      # the bit we care about is in the facets and is further narrowed by type
      data = data['search']['facets'][target_type]

      json_resources = []
      total = 0
      return [] if data.nil? || data['facet'].nil?
      if data['facet'].kind_of?(Array)
        # now, stuff this into a json data structure for db consumption
        data['facet'].each do | facet |
           if facet['name'].nil?
             name = '** unknown **'
           else
             name = facet['name'].strip
           end
           cnt = facet['count']
           total = total + cnt.to_i
           node_century = process_year_data(facet['pivots']['century'], min_year, max_year, 100)
           node_half_century = process_year_data(facet['pivots']['half_century'], min_year, max_year, 50)
           node_quarter_century = process_year_data(facet['pivots']['quarter_century'], min_year, max_year, 25)
           node_decade = process_year_data(facet['pivots']['decade'], min_year, max_year, 10)
           node_first_pub_year = process_year_data(facet['pivots']['year_sort_asc'], min_year, max_year, 1)
           json_resources << {:name=>name, :size=>facet['count'],
               :type=>"subfacet", :facet=>target_type,
               :archive_handle=>archive_handle, :other_facets=>prior_facets,
               :century=>node_century, :decade=>node_decade, :half_century=>node_half_century,
               :quarter_century=>node_quarter_century, :first_pub_year=>node_first_pub_year }
        end
      else
        facet = data['facet']
        if facet['name'].nil?
          name = '** unknown **'
        else
          name = facet['name'].strip
        end
        cnt = facet['count']
        total = total + cnt.to_i
        node_century = process_year_data(facet['pivots']['century'], min_year, max_year, 100)
        node_half_century = process_year_data(facet['pivots']['half_century'], min_year, max_year, 50)
        node_quarter_century = process_year_data(facet['pivots']['quarter_century'], min_year, max_year, 25)
        node_decade = process_year_data(facet['pivots']['decade'], min_year, max_year, 10)
        node_first_pub_year = process_year_data(facet['pivots']['year_sort_asc'], min_year, max_year, 1)
        json_resources << {:name=>name, :size=>cnt,
           :type=>"subfacet", :facet=>target_type,
           :archive_handle=>archive_handle, :other_facets=>prior_facets,
           :century=>node_century, :decade=>node_decade, :half_century=>node_half_century,
           :quarter_century=>node_quarter_century, :first_pub_year=>node_first_pub_year }
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

   def self.sum_centuries( children, centuries = nil)
     centuries = Hash.new if centuries.nil?
     children.each do |child|
       if !child[:children].nil? && child[:children].length > 0
         centuries = sum_centuries(child[:children], centuries)
         child[:century] = centuries
       elsif !child[:century].nil? && child[:century].length > 0
         child[:century].each do |curr_century, count|
             key = curr_century.to_s
             centuries[key] = 0 if centuries[key].nil?
             centuries[key] += count
         end
       end
     end
     return centuries
   end

   def self.sum_decades( children, decades = nil)
     decades = Hash.new if decades.nil?
     children.each do |child|
       if !child[:children].nil? && child[:children].length > 0
         decades = sum_decades(child[:children], decades)
         child[:decade] = decades
       elsif !child[:decade].nil? && child[:decade].length > 0
         child[:decade].each do |curr_decade, count|
           key = curr_decade.to_s
           decades[key] = 0 if decades[key].nil?
           decades[key] += count
         end
       end
     end
     return decades
   end

   def self.find_resource( match_key, name, resources)
      parent = nil
      resources.each do |jr|
         if jr[match_key] == name # and jr[:type] == "archive"
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

   def self.find_genre( match_key, name, resources)
     found = nil
     resources.each do |jr|
       if jr[match_key] == name and jr[:type] == "genre"
         found = jr
         break
       end
     end
     return found
   end


   def self.find_discipline( match_key, name, resources)
     found = nil
     resources.each do |jr|
       if jr[match_key] == name and jr[:type] == "discipline"
         found = jr
         break
       end
     end
     return found
   end


   def self.find_format( match_key, name, resources)
     found = nil
     resources.each do |jr|
       if jr[match_key] == name and jr[:type] == "format"
         found = jr
         break
       end
     end
     return found
   end


   def self.do_search(search_type, json_resources, query, dates)
      facet_name='doc_type' if search_type == :formats
      facet_name='genre' if search_type == :genres
      facet_name='discipline' if search_type == :disciplines
      facet_name='archive' if search_type == :archives

      min_year = 400
      max_year = 2100

      request = "#{Settings.catalog_url}/search.xml?max=0&facet=#{facet_name}&period_pivot=#{facet_name}"
      params = []
      if !query.nil?
         params << "q=#{CGI.escape(query)}"
      end
      if !dates.nil?
         params << "y=#{CGI.escape(dates)}"
      end
      qp = params.join("&")
      request << "&" << qp if !qp.empty?
      puts "=========== #{request}"

      resp = RestClient.get request
      resp = resp.gsub(/count/, "size")
      facet_data = Hash.from_xml resp
      arc_total = facet_data['search']['total']
      facet_data = facet_data['search']['facets']

      if search_type == :archives
        # use the name from data['archive']['facet'] to find a match in data from above
        # add size to the node data. Once complete, set data as the children of archives
        facet_data['archive']['facet'].each do |facet |
           node = find_resource( :handle, facet['name'], json_resources)
           if node.nil?
              puts "====================================> NO MATCH FOUND FOR RESOURCE FACET #{facet}"
           else
             node[:century] = process_year_data(facet['pivots']['century'], min_year, max_year, 100)
             node[:half_century] = process_year_data(facet['pivots']['half_century'], min_year, max_year, 50)
             node[:quarter_century] = process_year_data(facet['pivots']['quarter_century'], min_year, max_year, 25)
             node[:decade] = process_year_data(facet['pivots']['decade'], min_year, max_year, 10)
             node[:first_pub_year] = process_year_data(facet['pivots']['year_sort_asc'], min_year, max_year, 1)
              node[:size] = facet['size']
           end
        end
      end

      if search_type == :genres
        # use the name from data['genre']['facet'] to find a match in data from above
        # add size to the node data. Once complete, set data as the children of archives
        facet_data['genre']['facet'].each do |facet |
          node = find_genre( :name, facet['name'], json_resources)
          if node.nil?
            puts "====================================> NO MATCH FOUND FOR GENRE FACET #{facet}"
          else
            node[:century] = process_year_data(facet['pivots']['century'], min_year, max_year, 100)
            node[:half_century] = process_year_data(facet['pivots']['half_century'], min_year, max_year, 50)
            node[:quarter_century] = process_year_data(facet['pivots']['quarter_century'], min_year, max_year, 25)
            node[:decade] = process_year_data(facet['pivots']['decade'], min_year, max_year, 10)
            node[:first_pub_year] = process_year_data(facet['pivots']['year_sort_asc'], min_year, max_year, 1)
            node[:size] = facet['size']
          end
        end
      end

      if search_type == :disciplines
        # use the name from data['discipline']['facet'] to find a match in data from above
        # add size to the node data. Once complete, set data as the children of archives
        facet_data['discipline']['facet'].each do |facet |
          node = find_discipline( :name, facet['name'], json_resources)
          if node.nil?
            puts "====================================> NO MATCH FOUND FOR DISCIPLINE FACET #{facet}"
          else
            node[:century] = process_year_data(facet['pivots']['century'], min_year, max_year, 100)
            node[:half_century] = process_year_data(facet['pivots']['half_century'], min_year, max_year, 50)
            node[:quarter_century] = process_year_data(facet['pivots']['quarter_century'], min_year, max_year, 25)
            node[:decade] = process_year_data(facet['pivots']['decade'], min_year, max_year, 10)
            node[:first_pub_year] = process_year_data(facet['pivots']['year_sort_asc'], min_year, max_year, 1)
            node[:size] = facet['size']
          end
        end
      end

      if search_type == :formats
        # use the name from data['discipline']['facet'] to find a match in data from above
        # add size to the node data. Once complete, set data as the children of archives
        facet_data['doc_type']['facet'].each do |facet |
          node = find_format( :name, facet['name'], json_resources)
          if node.nil?
            puts "====================================> NO MATCH FOUND FOR FORMAT FACET #{facet}"
          else
            node[:century] = process_year_data(facet['pivots']['century'], min_year, max_year, 100)
            node[:half_century] = process_year_data(facet['pivots']['half_century'], min_year, max_year, 50)
            node[:quarter_century] = process_year_data(facet['pivots']['decade'], min_year, max_year, 25)
            node[:decade] = process_year_data(facet['pivots']['decade'], min_year, max_year, 10)
            node[:first_pub_year] = process_year_data(facet['pivots']['year_sort_asc'], min_year, max_year, 1)
            node[:size] = facet['size']
          end
        end
      end

      json_resources.each do |jr|
        if jr[:size].nil? and not jr[:children].nil?
          total = sum_children(jr[:children])
          puts "#{jr[:name]} summed size #{total}"
          jr[:size] = total
          centuries = sum_centuries(jr[:children])
          jr[:century] = centuries
          decades = sum_decades(jr[:children])
          jr[:decade] = decades
        end
      end

      return json_resources,arc_total
   end

   def self.sum_size_for_centuries(centuries, start_century, end_century = nil)
     total = 0
     end_century = start_century if end_century.nil?
     centuries.each do |century, count|
       curr_century = century.to_i
       if curr_centry >= start_century && curr_century <= end_century
         total += count
       end
     end
     return total
   end

   def self.sum_size_for_decades(decades, start_decade, end_decade)
     total = 0
     end_decade = start_decade if end_decade.nil?
     decades.each do |decade, count|
       curr_decade = decade.to_i
       if curr_decade >= start_decade && curr_decade <= end_decade
         total += count
       end
     end
     return total
   end

   def self.process_year_data(year_facet_data, min_year, max_year, factor)
     factor = 1 if factor.nil?
     years = Hash.new
     # if year_facet_data.is_a?(Hash)
     #   year_facet_data = [ year_facet_data ]
     # end
     values = year_facet_data['value']
     if values.is_a?(Hash)
       values = [ values ]
     end
     values.each do |facet|
       year = facet['name'].to_i
       if year >= min_year && year < max_year
         if facet['size'].nil?
           count = facet['count'].to_i
         else
           count = facet['size'].to_i
         end
         if count > 0
           curr_century = year - (year % factor)
           key = curr_century.to_s
           years[key] = 0 if years[key].nil?
           years[key] += count
         end
       end
     end
     return years
   end


   def self.get_resource_tree
      # get the data from the catalog. All catalog response are in XML
      xml_resp = RestClient.get "#{Settings.catalog_url}/archives.xml"

      # stuff xml into hash and prune it to resource tree
      data = Hash.from_xml xml_resp
      data = data['resource_tree']

      # convert nasty XML into something useful by D3; first walk the nodes to
      # build the high level hierarchy
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
      return json_resources
   end

   def self.get_genres
     # get the data from the catalog. All catalog response are in XML
     xml_resp = RestClient.get "#{Settings.catalog_url}/genres.xml"

     # stuff xml into hash
     data = Hash.from_xml xml_resp

     # convert nasty XML into something useful by D3; first walk the nodes to
     # build the high level hierarchy
     json_resources = []

     data['genres']['genre'].each do | node |
         json_resources << { :name=>node['name'].strip, :type=>"genre"}
     end
     return json_resources
   end

   def self.get_disciplines
     # get the data from the catalog. All catalog response are in XML
     xml_resp = RestClient.get "#{Settings.catalog_url}/disciplines.xml"

     # stuff xml into hash
     data = Hash.from_xml xml_resp

     # convert nasty XML into something useful by D3; first walk the nodes to
     # build the high level hierarchy
     json_resources = []

     data['disciplines']['discipline'].each do | node |
       json_resources << { :name=>node['name'].strip, :type=>"discipline"}
     end
     return json_resources
   end

   def self.get_formats
       # get the data from the catalog. All catalog responses are in XML
       # formats.xml is not implemented in the catalog. Have to use search query with facets
       request = "#{Settings.catalog_url}/search.xml?max=0&facet=doc_type"
       resp = RestClient.get request
       resp = resp.gsub(/count/, "size")
       # stuff xml into hash and prune it to format list
       facet_data = Hash.from_xml resp
       facet_data = facet_data['search']['facets']

       # convert nasty XML into something useful by D3; first walk the nodes to
       # build the high level hierarchy
       json_resources = []

       facet_data['doc_type']['facet'].each do | node |
         json_resources << { :name=>node['name'].strip, :type=>"format"}
       end

       return json_resources
   end

end