var fs = require('fs'),
	sqlite3 = require('sqlite3').verbose(),

	db = new sqlite3.Database('strokes.db'),

	width = 270,
	height = 270,
	color = ["#000080","#0000ff","#CCCCCC"],
	// cross the page in 1 sec
	speed = width,

	ids = [];

db.each("SELECT code_point FROM strokes GROUP BY code_point", function(err, row) {
	ids.push(row.code_point);
}, function(err, numRows){

	db.serialize(function(){
		ids.forEach(function(code_point){
			var c = String.fromCharCode(code_point),
				out = ['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+width+'" height="'+height+'">'],
				defs = ['<defs>'],
				plan = [],
				strokes = [],
				strokesSVG = [];
			db.each("SELECT ordinal,direction,is_radical,is_continuation,path FROM strokes WHERE code_point = " + code_point + " ORDER BY ordinal", function(err, stroke) {
				if(err){
					console.log(err);
					return true;
				}
				strokes.push(stroke);
			}, function(err, numRows){

				if(err){
					console.log(err);
					return;
				}

				var numStrokes = strokes.length;

				strokes.forEach(function(stroke){
					var i = stroke.ordinal,
						bounds = getBounds(stroke.path),
						x = bounds[0],
						y = bounds[1],
						w = bounds[2] - x,
						h = bounds[3] - y,
						values = getStartEndValues(stroke.direction, bounds),
						start = values[0],
						end = values[1],
						attr = values[2],
						dist = values[3],
						begin = i == 1 ? "0; animate"+numStrokes+".end + 1" : "animate" + (i - 1) + ".end",
						dur = (dist / speed).toFixed(3);

					if(i != 1 && !stroke.is_continuation){
						begin += " + 0.5";
					}

					plan.push('<path d="' + stroke.path + '" fill="'+color[2]+'"/>');
					strokesSVG.push('<path d="' + stroke.path + '" fill="'+ color[stroke.is_radical] +'" clip-path="url(#clip-mask-' + i + ')" />');
					defs.push(
						'<clipPath id="clip-mask-'+i+'">'
						+ 	'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'">'
						+		((i == 1) ? '' : '<set attributeName="'+attr+'" to="'+start+'" begin="0; animate'+numStrokes+'.end + 1" />')
						+ 		'<animate attributeName="'+attr+'" from="'+start+'" to="'+end+'" dur="'+dur+'" begin="'+begin+'" id="animate'+i+'" fill="freeze"/>'
						+	'</rect>'
						+'</clipPath>');
				});

				defs.push('</defs>');
				out.push(defs.join(""));
				out.push(drawPlan(width,height));
				out.push(plan.join(""));
				out.push(strokesSVG.join(""));
				out.push("</svg>");

				writeFile("svg/" + c + ".svg", out.join(""), code_point);
			});
		});
	});

	db.close();
});

function writeFile(fileName, data, i){
	fs.open(fileName, "w", function(err, fd){
		if(err){
			setTimeout(function(){writeFile(fileName, data, i)}, 50);
			return;
		}
		fs.write(fd, data, function(err, written, buffer){
			if(err){
				setTimeout(function(){writeFile(fileName, data, i)}, 50);
				return;
			}
			console.log("Written " + i);
			fs.close(fd);
		});

	});
}

function getBounds(path){
	var minX = 1E4,
		minY = 1E4,
		maxX = 0,
		maxY = 0,
		re = /(\d+) (\d+)/g,
		match;

	while(match = re.exec(path)){
		if(match[1] < minX) minX = parseInt(match[1]);
		if(match[2] < minY) minY = parseInt(match[2]);
		if(match[1] > maxX) maxX = parseInt(match[1]);
		if(match[2] > maxY) maxY = parseInt(match[2]);
	}

	return [minX, minY, maxX, maxY];
}

function getStartEndValues(direction, bounds){

	var x = bounds[0],
		y = bounds[1],
		w = bounds[2] - x,
		h = bounds[3] - y,
		out;

	switch(direction){
		case 0:
			// left to right
			out = [ x - w, x, "x", w];
			break;
		case 1:
			// top to bottom
			out = [ y - h, y, "y", h]
			break;
		case 2:
			// right to left
			out = [ x + w, x, "x", w];
			break;
		case 3:
			// bottom to top
			out = [ y + h, y, "y", h];
			break;
	}

	return out;
}
function drawPlan(w, h){
	return '<path d="' +
			"M 0 0 " +
			"L " + w + " " + h + " " +
			"M " + w + " 0 " +
			"L 0 " + h + " " +
			"M " + (w/2) + " 0 " +
			"L " + (w/2) + " " + h + " " +
			"M 0 " + (h/2) + " " +
			"L " + w + " " +(h/2) +
		'" stroke="' + color[2] + '" />';
}
