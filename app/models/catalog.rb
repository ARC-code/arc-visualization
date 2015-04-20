require 'rest_client'
require 'access'

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
   def self.archives(for_ip, do_period_pivot)
      # first, get the resource tree
      json_resources = get_resource_tree(for_ip)

      # at this point, there is a tree with no counts on it. Call search to
      # get the counts for all facets
      return do_search(for_ip, :archives, json_resources, nil, nil, do_period_pivot)
   end

   # get an xml report of the genres
   def self.genres(for_ip, do_period_pivot)
     # first, get the list of genres
     json_resources = get_genres(for_ip)
     # at this point, there is a list with no counts on it. Call search to
     # get the counts for all facets
     return do_search(for_ip, :genres, json_resources, nil, nil, do_period_pivot)
   end

   def self.disciplines(for_ip, do_period_pivot)
     # first, get the list of disciplines
     json_resources = get_disciplines(for_ip)
     # at this point, there is a list with no counts on it. Call search to
     # get the counts for all facets
     return do_search(for_ip, :disciplines, json_resources, nil, nil, do_period_pivot)
   end

   def self.formats(for_ip, do_period_pivot)
     # first, get the list of formats
     json_resources = get_formats(for_ip)
     # at this point, there is a list with no counts on it. Call search to
     # get the counts for all facets
     return do_search(for_ip, :formats, json_resources, nil, nil, do_period_pivot)
   end


   def self.search_archives(for_ip, query, dates, do_period_pivot )
      # first, get the resource tree
      json_resources = get_resource_tree(for_ip)

      # at this point, there is a tree with no counts on it. Call search to
      # get the counts for all facets
      return do_search(for_ip, :archives, json_resources, query, dates, do_period_pivot)
   end

   def self.search_genres(for_ip, query, dates, do_period_pivot )
     # first, get the resource tree
     json_resources = get_genres(for_ip)

     # at this point, there is a tree with no counts on it. Call search to
     # get the counts for all facets
     return do_search(for_ip, :genres, json_resources, query, dates, do_period_pivot)
   end

   def self.search_disciplines(for_ip, query, dates, do_period_pivot )
     # first, get the resource tree
     json_resources = get_disciplines(for_ip)

     # at this point, there is a tree with no counts on it. Call search to
     # get the counts for all facets
     return do_search(for_ip, :disciplines, json_resources, query, dates, do_period_pivot)
   end

   def self.search_formats(for_ip, query, dates, do_period_pivot )
     # first, get the resource tree
     json_resources = get_formats(for_ip)

     # at this point, there is a tree with no counts on it. Call search to
     # get the counts for all facets
     return do_search(for_ip, :formats, json_resources, query, dates, do_period_pivot)
   end


   def self.results(for_ip, prior_facets, search_terms, dates, pg = 0)
     min_year = 400
     max_year = 2100
     archive_handle = nil

     start = pg.to_i * 5

     query = "#{Settings.catalog_url}/search.xml?max=5&start=#{start}&facet=federation"

     archive_handle = prior_facets[:archive] unless prior_facets[:archive].nil?
     unless archive_handle.blank?
       unless Access.is_archive_searchable_for?(for_ip, archive_handle, nil)
         puts "ACCESS DENIED: #{archive_handle} full results from #{for_ip}"
         return []
       end
     end
     query << "&q=#{CGI.escape(search_terms)}" unless search_terms.nil?
     query << "&y=#{CGI.escape(dates)}" unless dates.nil?
     facets = []
     facets << "a=%2B#{CGI.escape(prior_facets[:archive])}" unless prior_facets[:archive].nil?
     facets << "g=%2B#{CGI.escape(prior_facets[:genre])}" unless prior_facets[:genre].nil?
     facets << "discipline=%2B#{CGI.escape(prior_facets[:discipline])}" unless prior_facets[:discipline].nil?
     facets << "doc_type=%2B#{CGI.escape(prior_facets[:doc_type])}" unless prior_facets[:doc_type].nil?
     facet_params = facets.join('&')
     facet_params = "&#{facet_params}" unless facet_params.empty?
     puts "QUERY: #{query}#{facet_params}"
     xml_resp = RestClient.get "#{query}#{facet_params}"
     data = Hash.from_xml xml_resp

     data = data['search']

     json_resources = []
     return [] if data.nil? || data['results'].nil?
     result_data = data['results']['result']
     unless result_data.kind_of?(Array)
       result_data = [ result_data ]
     end
     # now, stuff this into a json data structure for db consumption
     result_data.each do | result |
       if result['title'].nil?
         name = '** untitled **'
       else
         name = result['title'].strip
       end
       node_century = process_year_result_data(result['century'], min_year, max_year, 100)
       node_half_century = process_year_result_data(result['half_century'], min_year, max_year, 50)
       node_quarter_century = process_year_result_data(result['quarter_century'], min_year, max_year, 25)
       node_decade = process_year_result_data(result['decade'], min_year, max_year, 10)
       node_first_pub_year = get_first_pub_year_from_result_data(result['year'], min_year, max_year, 1)
       json_resources << {:name=>name, :type=>'object', :size=>1, :uri=>result['uri'],
                          :url=>result['url'], :has_full_text=>result['has_full_text'],
                          :is_ocr=>result['is_ocr'], :freeculture=>result['freeculture'],
                          :archive=>result['archive'], :discipline=>result['discipline'],
                          :genre=>result['genre'], :format=>result['doc_type'],
                          :author=>result['role_AUT'], :publisher=>result['role_PBL'],
                          :years=>result['year'],
                          :archive_handle=>archive_handle, :other_facets=>prior_facets,
                          :century=>node_century, :decade=>node_decade, :half_century=>node_half_century,
                          :quarter_century=>node_quarter_century, :first_pub_year=>node_first_pub_year }
     end
     return json_resources
   end


   def self.facet(for_ip, target_type, prior_facets, search_terms, dates, do_period_pivot = false)
      facet_name=target_type
      archive_handle = nil

      min_year = 400
      max_year = 2100

      # get access levels for the requester
      perms = Access.load_permissions_for(for_ip)

      # search for all  facets data for this archive
      query = "#{Settings.catalog_url}/search.xml?max=0"
#      if do_period_pivot
        query += "&period_pivot=#{facet_name}"
#      else
        query += "&facet=#{facet_name}"
#      end

      archive_handle = prior_facets[:archive] unless prior_facets[:archive].nil?
      unless archive_handle.blank?
        unless Access.is_archive_enabled?(perms, archive_handle, nil)
          puts "ACCESS DENIED: #{archive_handle} facets from #{for_ip}"
          return []
        end
      end

      query << "&q=#{CGI.escape(search_terms)}" unless search_terms.nil?
      query << "&y=#{CGI.escape(dates)}" unless dates.nil?
      facets = []
      facets << "a=%2B#{CGI.escape(prior_facets[:archive])}" unless prior_facets[:archive].nil?
      facets << "g=%2B#{CGI.escape(prior_facets[:genre])}" unless prior_facets[:genre].nil?
      facets << "discipline=%2B#{CGI.escape(prior_facets[:discipline])}" unless prior_facets[:discipline].nil?
      facets << "doc_type=%2B#{CGI.escape(prior_facets[:doc_type])}" unless prior_facets[:doc_type].nil?
      facet_params = facets.join('&')
      facet_params = "&#{facet_params}" unless facet_params.empty?
      puts "QUERY: #{query}#{facet_params}"
      xml_resp = RestClient.get "#{query}#{facet_params}"
      data = Hash.from_xml xml_resp

      # the bit we care about is in the facets and is further narrowed by type
      data = data['search']['facets'][target_type]

      json_resources = []
      total = 0
      return [] if data.nil? || data['facet'].nil?
      facet_data = data['facet']
      unless facet_data.kind_of?(Array)
        facet_data = [ facet_data ]
      end
      # now, stuff this into a json data structure for db consumption
      facet_data.each do | facet |
         if facet['name'].nil?
           name = '** unknown **'
         else
           name = facet['name'].strip
           handle = name if target_type == 'archive'
         end
         cnt = facet['count']
         item = { :name=>name, :size=>cnt,
                  :type=>'subfacet', :facet=>target_type, :handle=>handle,
                  :archive_handle=>archive_handle, :other_facets=>prior_facets }
         if target_type != 'archive' || Access.is_archive_visible?(perms, handle, nil)
           total = total + cnt.to_i
           if facet['pivots'].nil?
             node_century = []
             node_half_century = []
             node_quarter_century = []
             node_decade = []
             node_first_pub_year = []
           else
             node_century = process_year_data(facet['pivots']['century'], min_year, max_year, 100)
             node_half_century = process_year_data(facet['pivots']['half_century'], min_year, max_year, 50)
             node_quarter_century = process_year_data(facet['pivots']['quarter_century'], min_year, max_year, 25)
             node_decade = process_year_data(facet['pivots']['decade'], min_year, max_year, 10)
             node_first_pub_year = process_year_data(facet['pivots']['year_sort_asc'], min_year, max_year, 1)
           end
           item.reverse_merge!( { :century=>node_century, :decade=>node_decade, :half_century=>node_half_century,
               :quarter_century=>node_quarter_century, :first_pub_year=>node_first_pub_year } )
           if target_type == 'archive'
             short_name = I18n.t handle.squish.downcase.tr(' ','_'), default: handle.underscore.titleize
             item.reverse_merge!( { :enabled => Access.is_archive_enabled?(perms, handle, nil), :short_name=>short_name } )
           end
           json_resources << item
         end
      end
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
               unless parent.nil?
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
       if jr[match_key] == name and jr[:type] == 'genre'
         found = jr
         break
       end
     end
     return found
   end


   def self.find_discipline( match_key, name, resources)
     found = nil
     resources.each do |jr|
       if jr[match_key] == name and jr[:type] == 'discipline'
         found = jr
         break
       end
     end
     return found
   end


   def self.find_format( match_key, name, resources)
     found = nil
     resources.each do |jr|
       if jr[match_key] == name and jr[:type] == 'format'
         found = jr
         break
       end
     end
     return found
   end


   # Search for term(s) typed by user
   #
   def self.do_search(for_ip, search_type, json_resources, query, dates, do_period_pivot = false)
      facet_name=''
      facet_name='doc_type' if search_type == :formats
      facet_name='genre' if search_type == :genres
      facet_name='discipline' if search_type == :disciplines
      facet_name='archive' if search_type == :archives
         
         puts "++++++ DATES #{dates} ++++++++"

      min_year = 400
      max_year = 2100

      request = "#{Settings.catalog_url}/search.xml?max=0"
      if do_period_pivot
        request += "&period_pivot=#{facet_name}"
      else
        request += "&facet=#{facet_name}"
      end

      params = []
      unless query.nil?
         params << "q=#{CGI.escape(query)}"
      end
      unless dates.nil?
         params << "y=#{CGI.escape(dates)}"
      end
      qp = params.join('&')
      request << '&' << qp unless qp.empty?
      puts "=========== #{request}"

      resp = RestClient.get request
      resp = resp.gsub(/count/, 'size')
      facet_data = Hash.from_xml resp
      arc_total = facet_data['search']['total']
      facet_data = facet_data['search']['facets']

      if search_type == :archives && !facet_data['archive']['facet'].nil?
        # use the name from data['archive']['facet'] to find a match in data from above
        # add size to the node data. Once complete, set data as the children of archives
        facet_data['archive']['facet'].each do |facet |
           node = find_resource( :handle, facet['name'], json_resources)
           if node.nil?
              puts "====================================> NO MATCH FOUND FOR RESOURCE FACET #{facet}"
           elsif !facet['pivots'].nil?
             node[:century] = process_year_data(facet['pivots']['century'], min_year, max_year, 100)
             node[:half_century] = process_year_data(facet['pivots']['half_century'], min_year, max_year, 50)
             node[:quarter_century] = process_year_data(facet['pivots']['quarter_century'], min_year, max_year, 25)
             node[:decade] = process_year_data(facet['pivots']['decade'], min_year, max_year, 10)
             node[:first_pub_year] = process_year_data(facet['pivots']['year_sort_asc'], min_year, max_year, 1)
           end
           node[:size] = facet['size'] unless node.nil?
        end
      end

      if search_type == :genres && !facet_data['genre']['facet'].nil?
        # use the name from data['genre']['facet'] to find a match in data from above
        # add size to the node data. Once complete, set data as the children of archives
        facet_data['genre']['facet'].each do |facet |
          node = find_genre( :name, facet['name'], json_resources)
          if node.nil?
            puts "====================================> NO MATCH FOUND FOR GENRE FACET #{facet}"
          elsif !facet['pivots'].nil?
            node[:century] = process_year_data(facet['pivots']['century'], min_year, max_year, 100)
            node[:half_century] = process_year_data(facet['pivots']['half_century'], min_year, max_year, 50)
            node[:quarter_century] = process_year_data(facet['pivots']['quarter_century'], min_year, max_year, 25)
            node[:decade] = process_year_data(facet['pivots']['decade'], min_year, max_year, 10)
            node[:first_pub_year] = process_year_data(facet['pivots']['year_sort_asc'], min_year, max_year, 1)
          end
          node[:size] = facet['size'] unless node.nil?
        end
      end

      if search_type == :disciplines && !facet_data['discipline']['facet'].nil?
        # use the name from data['discipline']['facet'] to find a match in data from above
        # add size to the node data. Once complete, set data as the children of archives
        facet_data['discipline']['facet'].each do |facet |
          node = find_discipline( :name, facet['name'], json_resources)
          if node.nil?
            puts "====================================> NO MATCH FOUND FOR DISCIPLINE FACET #{facet}"
          elsif !facet['pivots'].nil?
            node[:century] = process_year_data(facet['pivots']['century'], min_year, max_year, 100)
            node[:half_century] = process_year_data(facet['pivots']['half_century'], min_year, max_year, 50)
            node[:quarter_century] = process_year_data(facet['pivots']['quarter_century'], min_year, max_year, 25)
            node[:decade] = process_year_data(facet['pivots']['decade'], min_year, max_year, 10)
            node[:first_pub_year] = process_year_data(facet['pivots']['year_sort_asc'], min_year, max_year, 1)
          end
          node[:size] = facet['size'] unless node.nil?
        end
      end

      if search_type == :formats && !facet_data['doc_type']['facet'].nil?
        # use the name from data['discipline']['facet'] to find a match in data from above
        # add size to the node data. Once complete, set data as the children of archives
        facet_data['doc_type']['facet'].each do |facet |
          node = find_format( :name, facet['name'], json_resources)
          if node.nil?
            puts "====================================> NO MATCH FOUND FOR FORMAT FACET #{facet}"
          elsif !facet['pivots'].nil?
            node[:century] = process_year_data(facet['pivots']['century'], min_year, max_year, 100)
            node[:half_century] = process_year_data(facet['pivots']['half_century'], min_year, max_year, 50)
            node[:quarter_century] = process_year_data(facet['pivots']['decade'], min_year, max_year, 25)
            node[:decade] = process_year_data(facet['pivots']['decade'], min_year, max_year, 10)
            node[:first_pub_year] = process_year_data(facet['pivots']['year_sort_asc'], min_year, max_year, 1)
          end
          node[:size] = facet['size'] unless node.nil?
        end
      end

      json_resources.each do |jr|
        if jr[:size].nil? and not jr[:children].nil?
          total = sum_children(jr[:children])
          puts "#{jr[:name]} summed size #{total}"
          jr[:size] = total
          # centuries = sum_centuries(jr[:children])
          # jr[:century] = centuries
          # decades = sum_decades(jr[:children])
          # jr[:decade] = decades
        end
      end

      return json_resources,arc_total
   end

   def self.sum_size_for_centuries(centuries, start_century, end_century = nil)
     total = 0
     end_century = start_century if end_century.nil?
     centuries.each do |century, count|
       curr_century = century.to_i
       if curr_century >= start_century && curr_century <= end_century
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


   def self.process_year_result_data(year_result_data, min_year, max_year, factor)
     factor = 1 if factor.nil?
     years = Hash.new
     unless year_result_data.nil?
       year_result_data = year_result_data['value'] unless year_result_data['value'].nil?
       year_result_data = [ year_result_data ] unless year_result_data.is_a?(Array)
       year_result_data.each do |year_data|
         year = year_data.to_i
         if year >= min_year && year < max_year
           curr_century = year - (year % factor)
           key = curr_century.to_s
           years[key] = 1
         end
       end
     end
     return years
   end

   # noinspection RubyClassMethodNamingConvention
   def self.get_first_pub_year_from_result_data(year_result_data, min_year, max_year, factor)
     factor = 1 if factor.nil?
     years = Hash.new
     year_result_data = year_result_data['value'] unless year_result_data['value'].nil?
     year_result_data = [ year_result_data ] unless year_result_data.is_a?(Array)
     lowest_year = 999999
     year_result_data.each do |year_data|
       year = year_data.to_i
       if year < lowest_year
         curr_century = year - (year % factor)
         lowest_year = curr_century
       end
     end
     key = lowest_year.to_s
     if lowest_year >= min_year && lowest_year < max_year
       years[key] = 1
     else
       years[key] = 0
     end
     return years
   end



   def self.get_resource_tree(for_ip)
      # get access levels for the requester
      perms = Access.load_permissions_for(for_ip)

      # get the data from the catalog. All catalog response are in XML
      xml_resp = RestClient.get "#{Settings.catalog_url}/archives.xml"

      # stuff xml into hash and prune it to resource tree
      data = Hash.from_xml xml_resp
      data = data['resource_tree']

      # convert nasty XML into something useful by D3; first walk the nodes to
      # build the high level hierarchy
      json_resources = []
      data['nodes']['node'].each do | node |
         if Access.is_archive_group_visible?(perms, node['name'])
            # if node is top-level, it will not have a parent attrib (grr)
            if node['parent'].nil?
               json_resources << { :name=>node['name'], :children=>[], :type=>'group'}
            else
               # recursively walk tree to find the parent resource
               parent = find_resource(:name, node['parent'], json_resources)
               unless parent.nil?
                  parent[:children] << { :name=>node['name'], :children=>[], :type=>'group' }
               end
            end
         end
      end

      # Now walk the archives data and add as child to the main resource tree
      data['archives']['archive'].each do | archive |
         short_name = nil
         if Access.is_archive_visible?(perms, archive['handle'], archive['parent'])
            # recursively walk tree to find the parent resource
            parent = find_resource( :name, archive['parent'], json_resources )
            unless parent.nil?
               handle = archive['handle']
               short_name = I18n.t handle.squish.downcase.tr(' ','_'), default: handle.underscore.titleize unless handle.nil?
               parent[:children]  << { :name=>archive['name'], :short_name=>short_name, :handle=>archive['handle'], :type=>'archive',
                                      :enabled => Access.is_archive_enabled?(perms, archive['handle'], archive['parent']) }
            end
         end
      end
      return json_resources
   end

   def self.get_genres(for_ip)
     # get the data from the catalog. All catalog response are in XML
     xml_resp = RestClient.get "#{Settings.catalog_url}/genres.xml"

     # stuff xml into hash
     data = Hash.from_xml xml_resp

     # convert nasty XML into something useful by D3; first walk the nodes to
     # build the high level hierarchy
     json_resources = []

     data['genres']['genre'].each do | node |
         json_resources << { :name=>node['name'].strip, :type=>'genre'}
     end
     return json_resources
   end

   def self.get_disciplines(for_ip)
     # get the data from the catalog. All catalog response are in XML
     xml_resp = RestClient.get "#{Settings.catalog_url}/disciplines.xml"

     # stuff xml into hash
     data = Hash.from_xml xml_resp

     # convert nasty XML into something useful by D3; first walk the nodes to
     # build the high level hierarchy
     json_resources = []

     data['disciplines']['discipline'].each do | node |
       json_resources << { :name=>node['name'].strip, :type=>'discipline'}
     end
     return json_resources
   end

   def self.get_formats(for_ip)
       # get the data from the catalog. All catalog responses are in XML
       # formats.xml is not implemented in the catalog. Have to use search query with facets
       request = "#{Settings.catalog_url}/search.xml?max=0&facet=doc_type"
       resp = RestClient.get request
       resp = resp.gsub(/count/, 'size')
       # stuff xml into hash and prune it to format list
       facet_data = Hash.from_xml resp
       facet_data = facet_data['search']['facets']

       # convert nasty XML into something useful by D3; first walk the nodes to
       # build the high level hierarchy
       json_resources = []

       facet_data['doc_type']['facet'].each do | node |
         json_resources << { :name=>node['name'].strip, :type=>'format'}
       end

       return json_resources
   end

end