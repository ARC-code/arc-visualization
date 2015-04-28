module HomeHelper
   def trim_title(url, title)
      
      max_len = 64
      title.gsub!(/\n/, " ")
      link = "<a href='#{url}' target='_blank'>X</a>"
      fixed = title 
      if title.length > max_len
         fixed = title[0..max_len].gsub(/\s\w+\s*$/,'...')
      end
      return link.gsub(/X/, fixed)
   end
   
   def author( a ) 
      return "Unknown" if a.nil?
      return a["value"]
   end
   
   def pub_dates(years_json)
      years = years_json["value"]
      return "Unknown" if years.length == 0
      return years if !years.kind_of?(Array)
      return years[0] if years.length == 1
      return "#{years[0]}-#{years[years.length-1]}"
   end
end
