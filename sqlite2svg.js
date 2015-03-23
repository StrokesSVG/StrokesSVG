var fs = require('fs'),
	sqlite3 = require('sqlite3').verbose(),

	db = new sqlite3.Database('strokes.db'),

	// Fixed by the data in the database
	WIDTH = 270,
	HEIGHT = 270,

	ouputDir = "compress",
	colorPlan = "#CCCCCC",
	colorRadical = ["#000080","#0000ff"],
	colorGrad = ["#000000", "#ff0000"],
	// cross the page in 1 sec
	speed = WIDTH,
	mode = 'grad', // radical, grad, black,
	showPlan = true,
	animate = false,
	pauseOnCompletedTime = "1s",
	compressPaths = true,

	ids = [];

db.each("SELECT code_point FROM strokes GROUP BY code_point", function(err, row) {
	ids.push(row.code_point);
}, function(err, numRows){

	db.serialize(function(){
		ids.forEach(function(code_point){
			var c = String.fromCharCode(code_point),
				out = ['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+WIDTH+'" height="'+HEIGHT+'">'],
				defs = ['<defs>'],
				plan = [],
				strokes = [],
				strokesSVG = [],
				mainStrokes = 0;
			db.each("SELECT ordinal,direction,is_radical,is_continuation,path FROM strokes WHERE code_point = " + code_point + " ORDER BY ordinal", function(err, stroke) {
				if(err){
					console.log(err);
					return true;
				}
				if(!stroke.is_continuation){
					mainStrokes++;
				}
				strokes.push(stroke);
			}, function(err, numRows){

				if(err){
					console.log(err);
					return;
				}

				var numStrokes = strokes.length,
						strokeNum = 0;

				strokes.forEach(function(stroke){
					if(!stroke.is_continuation){
						strokeNum++;
					}
					stroke.totalStrokes = mainStrokes;
					stroke.strokeNum = strokeNum;

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
						begin = i == 1 ? "0; animate"+numStrokes+".end + " + pauseOnCompletedTime :
							"animate" + (i - 1) + ".end",
						dur = (dist / speed).toFixed(3),
						path = compressPaths ? compressPath(stroke.path) : stroke.path;

					if(i != 1 && !stroke.is_continuation){
						begin += " + 0.5";
					}

					if(showPlan){
						plan.push('<path d="' + path + '" fill="'+colorPlan+'"/>');
					}

					strokesSVG.push('<path d="' + path + '" fill="'+ getColor(stroke) +'"'+ (animate ? ' clip-path="url(#clip-mask-' + i + ')"' : '') + ' />');

					if(animate){
						defs.push(
							'<clipPath id="clip-mask-'+i+'">'
							+ 	'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'">'
							+		((i == 1) ? '' : '<set attributeName="'+attr+'" to="'+start+'" begin="0; animate'+numStrokes+'.end + '+pauseOnCompletedTime+'" />')
							+ 		'<animate attributeName="'+attr+'" from="'+start+'" to="'+end+'" dur="'+dur+'" begin="'+begin+'" id="animate'+i+'" fill="freeze"/>'
							+	'</rect>'
							+'</clipPath>');
						}
				});

				if(animate){
					defs.push('</defs>');
					out.push(defs.join(""));
				}
				if(showPlan){
					out.push(drawPlan(WIDTH,HEIGHT));
					out.push(plan.join(""));
				}
				out.push(strokesSVG.join(""));
				out.push("</svg>");

				writeFile(ouputDir + "/" + c + ".svg", out.join(""), code_point);
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

function compressPath(path){
	var re = /\w[\W\d]+/g,
			match,
			lastX,
			lastY,
			points,
			x,
			y,
			out = [];
	while(match = re.exec(path)){
		points = match[0].split(" ");
		switch(points[0]) {
			case 'M':
				// Assume only one M and not relative
				out.push("M");
				x = points[1];
				y = points[2];
				out.push(x);
				out.push(y);
				break;
			case 'L':
				out.push("l");
				x = points[1];
				y = points[2];
				out.push(x - lastX);
				out.push(y - lastY);
				break;
			case 'Q':
				out.push("q");
				out.push(points[1] - lastX);
				out.push(points[2] - lastY);
				x = points[3];
				y = points[4];
				out.push(x - lastX);
				out.push(y - lastY);
				break;
		}

		lastX = x;
		lastY = y;
	}
	return out.join(" ");
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

function getColor(stroke){
	if(mode == 'black'){
		return "#000000";
	}

	if(mode == 'radical'){
		return colorRadical[stroke.is_radical];
	}

	if(mode == 'grad'){
		var s_i = (stroke.totalStrokes == 1) ? 1 : (stroke.strokeNum - 1),
				s_1 = (stroke.totalStrokes - 1) || 1,
				r_0 = parseInt(colorGrad[0].substr(1,2),16),
				g_0 = parseInt(colorGrad[0].substr(3,2),16),
				b_0 = parseInt(colorGrad[0].substr(5,2),16),
				r_1 = parseInt(colorGrad[1].substr(1,2),16),
				g_1 = parseInt(colorGrad[1].substr(3,2),16),
				b_1 = parseInt(colorGrad[1].substr(5,2),16),
				r_i = r_0 + (r_1 - r_0) * (s_i / s_1),
				g_i = g_0 + (g_1 - g_0) * (s_i / s_1),
				b_i = b_0 + (b_1 - b_0) * (s_i / s_1),
				out = "#" + pad((r_i |0).toString(16))
									+ pad((g_i |0).toString(16))
									+ pad((b_i |0).toString(16));
		return out;
	}

	return "#000000";
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
		'" stroke="' + colorPlan + '" />';
}

function pad(s){
	if(s.length  == 1){
		return "0" + s;
	}
	return s;
}
