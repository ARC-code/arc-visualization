var pageID = ''
var resources = []
var projectNames = []
var sphereNames = []

function defineActiveLink(pageID) {
	if (pageID === "genre") {
		document.getElementById("sortByGenre").classList.add('active');
	}
	if (pageID === "alpha") {
		document.getElementById("sortAlphabetically").classList.add('active');
	}
}

function getData() {
	d3.csv("/resources/BigDIVA_Resources.csv", function(error,data) {
		saveData(data);
	});	
}

function saveData(d) {
	var resourceName = d.forEach(function(e) {
		var sphereName_each = e.AsOnSphere;
		var projectName = e.ProjectName;
		var resourceURL = e.URL;
		resources.push({
			sphere: sphereName_each, 
			project: projectName, 
			url: resourceURL
		})
		
	});
	resources.sort(function(a,b){
		return a.sphere.localeCompare(b.sphere);
	});
	
	displayData(resources);
		
		
}

function displayData(d) {
	var resourceGroup = d3.select('#resourceNames').selectAll('.resource')
		.data(d)
		.enter()
		.append('div')
		.attr('class', 'resource')
		.attr('id', function (d) {id = d.sphere;id=id.replace(/\s/g, '');return id;});
	resourceGroup.append('div')
		.attr('class', 'sphereName')
		.html(function (d) {return d.sphere});
	resourceGroup.append('div')
		.attr('class', 'projectName')
		.html(function (d) {link='<a href="' + d.url + '">' + d.project + '</a>'; return link});
/*
		.append('div')
		.attr('class', 'resource')
		.attr('id', function (d) {for (x in d) {id = d[x];id=id.replace(/\s/g, '');return id;}})
		.html(function (d) {for (x in d) {console.log(d); console.log(d[x]);}});
*/
/*
		d3.select('#resourceNames')
			.append('div')
			.attr('class', 'resource')
			.attr('id', sphereName_noSpaces);
*/
/*
			.attr('id', sphereName_noSpaces)
			.append('div')
			.attr('class', sphereName + ' projectName')
			.html(projectName)
			.select('.resource')
			.append('div')
			.enter();
*/	
}


function letterInteraction(l) {
	var id = document.getElementById(l)
	id.onmouseover = 
		function() {
			if (id.class != "letterBox clicked") {
				id.style.fontWeight = "bold";
			}
		}
	id.onmouseout =
		function () {
			if (id.class != "letterBox clicked") {
				id.style.fontWeight = "normal";
			}
			if (id.className === "letterBox clicked") {
				id.style.fontWeight = "bold";
			}
		}
	id.onmouseup = 
		function filterResources(e) {
			if (id.className === "letterBox clicked") {
				id.className = "letterBox";
				d3.select('#resourceNames')
					.html('');
				displayData(resources);
			}
			else if (id.class != "letterBox clicked") {
				id.className += " clicked";
				id.style.fontWeight = "bold";
				d3.select('#resourceNames')
					.html('');
				allClicked = document.getElementsByClassName("letterBox clicked");
				for (var i = 0; i < allClicked.length; i++) {
					if (allClicked[i].id != id.id) {
						allClicked[i].style.fontWeight = "normal";
						allClicked[i].className = "letterBox";
					}
				}
				displayData(resources.filter(
					function(d) {
						sphere_firstLetter = d.sphere.charAt(0);
						if (sphere_firstLetter === l) {
							return d;
						} else if ((l === '#') && (sphere_firstLetter === '1' || sphere_firstLetter === '2' )) {
							return d;
						}
					}
				));
			}
		}

}

var alphabet = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
var letter = ''
function createAlphabet() {
	var containerWidth = document.getElementById('alphabet').clientWidth;
	alphabet.forEach( function(l) {
		letter = l
		div = d3.select('#alphabet')
			.append('div')
			.attr('id', letter)
			.attr('class','letterBox')
			.attr('height', 2 + 'em')
	        .attr('width', (.038 * containerWidth) + 'px')
			.style('padding','1%')
	        
		var text = div.append('div')
			.html(letter)
			.style('font-size','1.5em')
			.attr('height', 2 + 'em')
	        .attr('width', (.038 * containerWidth) + 'px')
		letterInteraction(letter);
	});    
	
}





