var fs = require('fs');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('strokes.db');

var ids = [],
    outputDir = "svg",
    indices = [];

db.each("SELECT code_point FROM strokes GROUP BY code_point", function(err, row) {
	ids.push(row.code_point);
}, function(err, numRows){

	var imgs = ids.map(function(code_point){
		var c = String.fromCharCode(code_point);
		return '<img src="'+c+'.svg" width="270" height="270" />';
	});

	var i = 0;
	while(imgs.length){
		var slice = imgs.splice(0, 50),
        idSlice = ids.splice(0, 50);

		(function(i,slice){
			fs.open(outputDir + "/index"+i+".html", "w", function(err, fd){
				if(err){
					console.log(err);
					return;
				}
				fs.write(fd, slice.join(" "), function(err, written, buffer){
					console.log("Written " + i);
					fs.close(fd);
				});

			});
		}(i, slice));

    indices.push('<li><a href="index'+i+'.html">Index ' + i + ': Code Points ' + idSlice[0] + '-' + idSlice[slice.length-1] + '</a>');

		i++;
	}

  fs.open(outputDir + "/index.html", "w", function(err, fd){
    if(err){
      console.log(err);
      return;
    }
    fs.write(fd, "<ul>"+indices.join("")+"</ul>", function(err, written, buffer){
      console.log("Written Index");
      fs.close(fd);
    });

  });

	db.close();
});
