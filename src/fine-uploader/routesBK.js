var express = require("express"),
    fs = require("fs"),
    rimraf = require("rimraf"),
    mkdirp = require("mkdirp"),
    multiparty = require('multiparty'),
    app = express(),
    path = require('path'),
    async = require('async'),
    mysql = require('mysql'),
    config = require('mainconf'),
    connection = mysql.createConnection(config.commondb_connection);
var fileInputName = process.env.FILE_INPUT_NAME || "qqfile",
    maxFileSize = process.env.MAX_FILE_SIZE || 0; // in bytes, 0 for unlimited



// paths/constants
//     fileInputName = process.env.FILE_INPUT_NAME || "qqfile",
//     publicDir = process.env.PUBLIC_DIR || "/public",
//     nodeModulesDir = process.env.NODE_MODULES_DIR || "/node_modules",
//     uploadedFilesPath = process.env.UPLOADED_FILES_DIR || "/uploadfolder",
//     chunkDirName = "chunks",
//     port = process.env.SERVER_PORT || 8009,
//     maxFileSize = process.env.MAX_FILE_SIZE || 0; // in bytes, 0 for unlimited


// routes.listen(port);
// console.log('Upload Demo happen on port ' + port);
connection.query('USE ' + config.Login_db); // Locate Login DB
// routes
module.exports = function (app, passport) {

    // routes.use(express.static(publicDir));
    // routes.use("/node_modules", express.static(nodeModulesDir));
    // routes.use("/css", express.static(__dirname + "/css"));
    // routes.use("/scripts", express.static(__dirname + "/scripts"));
    // routes.use("/pic", express.static(__dirname + "/pic"));
    // routes.set('views', path.join(__dirname, 'views'));
    // routes.engine('ejs', require('ejs').renderFile);
    // routes.set('view engine', 'ejs');

    app.post("/upload", onUpload);
    app.post("/submit", function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header

        var newImage = {
            imagePath: "http://faw.aworldbridgelabs.com/uploadfiles/" + responseDataUuid,
            fileName: responseDataUuid
        };
        console.log("path: " + responseDataUuid);
        console.log("names: " + responseDataUuid);


        var myStat = "INSERT INTO Julia.FineUploader (imagePath, fileName) VALUES (?,?)";
        var myVal = [newImage.imagePath, newImage.fileName];
        console.log("query statement : " + myStat);
        console.log("values: " + myVal);

        connection.query(myStat, myVal, function (err, results) {
            if (err) {
                console.log("query statement T^T: " + myStat);
                console.log("values T^T: " + myVal);
                console.log(err);
                res.send("Unfortunately, there has been an error!");
                res.end();
            } else {
                console.log("query statement yay: " + myStat);
                console.log("values yay: " + myVal);
                console.log("All a big success!");
                res.send("All a big success!");
                res.end();
            }

        });
    });
    app.delete("/deleteFiles/:uuid", onDeleteFile);
    app.get('/', function (req, res) {
        console.log("10");
        res.render("test.ejs");
    });

    app.get('/edit', function (req, res) {
        // res.render("test.ejs");
        // console.log("11");
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header

        var myStat = "SELECT * FROM Julia.FineUploader";

        var filePath0;
        connection.query(myStat, function (err, results) {
            console.log("query statement : " + myStat);

            if (!results[0].imagePath) {
                console.log("Error");
            } else {
                filePath0 = results[0];
                var JSONresult = JSON.stringify(results, null, "\t");
                console.log(JSONresult);
                res.send(JSONresult);
                res.end()
            }

        });


    });
};

function onUpload(req, res, next) {
    var form = new multiparty.Form();

    form.parse(req, function(err, fields, files) {
        console.log(fields);
        var partIndex = fields.qqpartindex;

        // text/plain is required to ensure support for IE9 and older
        res.set("Content-Type", "text/plain");

        if (partIndex == null) {
            onSimpleUpload(fields, files[fileInputName][0], res);
        }
        else {
            onChunkedUpload(fields, files[fileInputName][0], res);
        }
    });
    console.log("the other: " + responseDataUuid);

    // return next();
}

var responseDataUuid = "",
    responseDataName = "";
function onSimpleUpload(fields, file, res) {
    var d = new Date(),
        uuid = d.getUTCFullYear() + "-" + ('0' + (d.getUTCMonth() + 1)).slice(-2) + "-" + ('0' + d.getUTCDate()).slice(-2) + "T" + ('0' + d.getUTCHours()).slice(-2) + ":" + ('0' + d.getUTCMinutes()).slice(-2) + ":" + ('0' + d.getUTCSeconds()).slice(-2) + "Z",
        responseData = {
            success: false,
            newuuid: uuid + "_" + fields.qqfilename
        };

    responseDataUuid = responseData.newuuid;

    file.name = fields.qqfilename;
    responseDataName = file.name;

    console.log("forth hokage: " + responseDataUuid);
    console.log("fifth harmony: " + responseDataName);

    if (isValid(file.size)) {
        moveUploadedFile(file, uuid, function() {
                responseData.success = true;
                res.send(responseData);
            },
            function() {
                responseData.error = "Problem copying the file!";
                res.send(responseData);
            });
    }
    else {
        failWithTooBigFile(responseData, res);
    }
}

function onChunkedUpload(fields, file, res) {
    var size = parseInt(fields.qqtotalfilesize),
        uuid = fields.qquuid,
        index = fields.qqpartindex,
        totalParts = parseInt(fields.qqtotalparts),
        responseData = {
            success: false
        };

    file.name = fields.qqfilename;

    if (isValid(size)) {
        storeChunk(file, uuid, index, totalParts, function() {
                if (index < totalParts - 1) {
                    responseData.success = true;
                    res.send(responseData);
                }
                else {
                    combineChunks(file, uuid, function() {
                            responseData.success = true;
                            res.send(responseData);
                        },
                        function() {
                            responseData.error = "Problem conbining the chunks!";
                            res.send(responseData);
                        });
                }
            },
            function(reset) {
                responseData.error = "Problem storing the chunk!";
                res.send(responseData);
            });
    }
    else {
        failWithTooBigFile(responseData, res);
    }
}

function failWithTooBigFile(responseData, res) {
    responseData.error = "Too big!";
    responseData.preventRetry = true;
    res.send(responseData);
}

function onDeleteFile(req, res) {
    console.log("A");
    var uuid = req.params.uuid,
        dirToDelete = "var/www/faw/current/uploadfolder/" + uuid;
    console.log(uuid);
    rimraf(dirToDelete, function(error) {
        if (error) {
            console.error("Problem deleting file! " + error);
            res.status(500);
        }

        res.send();
    });
}

function isValid(size) {
    return maxFileSize === 0 || size < maxFileSize;
}

function moveFile(destinationDir, sourceFile, destinationFile, success, failure) {
    console.log(destinationDir);
    mkdirp(destinationDir, function(error) {
        var sourceStream, destStream;

        if (error) {
            console.error("Problem creating directory " + destinationDir + ": " + error);
            failure();
        }
        else {
            sourceStream = fs.createReadStream(sourceFile);
            destStream = fs.createWriteStream(destinationFile);

            sourceStream
                .on("error", function(error) {
                    console.error("Problem copying file: " + error.stack);
                    destStream.end();
                    failure();
                })
                .on("end", function(){
                    destStream.end();
                    success();
                })
                .pipe(destStream);

            // res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
            //
            // var newImage = {
            //     imagePath: req.body.imagePath,
            //     status: req.body.status
            // };
            //
            // var myStat = "INSERT INTO Julia.FineUploader";
            //
            // var filePath0;
            // connection.query(myStat, function (err, results) {
            //     console.log("query statement : " + myStat);
            //
            //     if (!results[0].imagePath) {
            //         console.log("Error");
            //     } else {
            //         filePath0 = results[0];
            //         var JSONresult = JSON.stringify(results, null, "\t");
            //         console.log(JSONresult);
            //         res.send(JSONresult);
            //         res.end()
            //     }
            //
            // });
        }
    });
}

function moveUploadedFile(file, uuid, success, failure) {
    console.log("this is: " + uuid);
    // var destinationDir = uploadedFilesPath + uuid + "/",
    var destinationDir = "uploadfolder/",
        fileDestination = destinationDir + uuid + "_" + file.name;

    moveFile(destinationDir, file.path, fileDestination, success, failure);
}

function storeChunk(file, uuid, index, numChunks, success, failure) {
    var destinationDir = uploadedFilesPath + uuid + "/" + chunkDirName + "/",
        chunkFilename = getChunkFilename(index, numChunks),
        fileDestination = destinationDir + chunkFilename;

    moveFile(destinationDir, file.path, fileDestination, success, failure);
}

function combineChunks(file, uuid, success, failure) {
    var chunksDir = uploadedFilesPath + uuid + "/" + chunkDirName + "/",
        destinationDir = uploadedFilesPath + uuid + "/",
        fileDestination = destinationDir + file.name;


    fs.readdir(chunksDir, function(err, fileNames) {
        var destFileStream;

        if (err) {
            console.error("Problem listing chunks! " + err);
            failure();
        }
        else {
            fileNames.sort();
            destFileStream = fs.createWriteStream(fileDestination, {flags: "a"});

            appendToStream(destFileStream, chunksDir, fileNames, 0, function() {
                    rimraf(chunksDir, function(rimrafError) {
                        if (rimrafError) {
                            console.log("Problem deleting chunks dir! " + rimrafError);
                        }
                    });
                    success();
                },
                failure);
        }
    });
}

function appendToStream(destStream, srcDir, srcFilesnames, index, success, failure) {
    if (index < srcFilesnames.length) {
        fs.createReadStream(srcDir + srcFilesnames[index])
            .on("end", function() {
                appendToStream(destStream, srcDir, srcFilesnames, index + 1, success, failure);
            })
            .on("error", function(error) {
                console.error("Problem appending chunk! " + error);
                destStream.end();
                failure();
            })
            .pipe(destStream, {end: false});
    }
    else {
        destStream.end();
        success();
    }
}

function getChunkFilename(index, count) {
    var digits = new String(count).length,
        zeros = new Array(digits + 1).join("0");

    return (zeros + index).slice(-digits);
}

app.post('/generalForm', isLoggedIn, function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    //console.log(req.body);

    var result = Object.keys(req.body).map(function (key) {
        return [String(key), req.body[key]];
    });
    console.log (result);

    var name = "";
    var value = "";

    for (var i = 0; i < result.length; i++) {
        if (result[i][0] === "Latitude_direction" || result[i][0] === "Longitude_direction") {
            // lati and long
            name += result[i][0].substring(0, result[i][0].length - 10) + ", ";
            value += '"' + result[i][1] + " " + result[i + 1][1] + "° " + result[i + 2][1] + "' " + result[i + 3][1] + "''" + '"' + ", ";
            i = i + 3;
        } else if (result[i][0] === "Field_size_integer") {
            // field size
            name += result[i][0].substring(0, result[i][0].length - 8) + ", ";
            // one decimal place = divide by 10
            value += '"' + (parseFloat(result[i][1]) + (result[i + 1][1] / 10)) + '"' + ", ";
            i = i + 1;
        } else if (result[i][0] === "Rotation_intercropping_crop") {
            name += result[i][0] + ", ";
            var str = result[i][1].toString();
            str = str.replace(/,/g, "/");
            value += '"' + str + '"' + ", ";
        } else {
            // normal
            if (result[i][1] !== "") {
                name += result[i][0] + ", ";
                value += '"' + result[i][1] + '"' + ", ";
            }
        }
    }

    name = name.substring(0, name.length - 2);
    value = value.substring(0, value.length - 2);

    // console.log(name);
    // console.log(value);
    var deleteStatement = "DELETE FROM General_Form WHERE transactionID = '" + req.body.transactionID + "'; ";
    var insertStatement = "INSERT INTO General_Form (" + name + ") VALUES (" + value + ");";
    console.log(insertStatement);

    connection.query(deleteStatement + insertStatement, function (err, results, fields) {
        if (err) {
            console.log(err);
            res.json({"error": true, "message": "Insert Error! Check your entry."});
        } else {
            res.json({"error": false, "message": "/detailedForm"});
        }
    });
});