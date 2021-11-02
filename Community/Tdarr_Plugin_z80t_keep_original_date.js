/* eslint-disable */
module.exports.dependencies = [
    "axios",
    "path-extra",
    "utimes,"
];

module.exports.details = function details() {
    return {
        id: "Tdarr_Plugin_z80t_keep_original_date",
        Stage: "Post-processing",
        Name: "Keep original file dates and times after transcoding",
        Type: "Video",
        Operation: "",
        Description: `This plugin copies the original file dates and times to the transcoded file \n\n`,
        Version: "1.10",
        Link: "",
        Tags: "post-processing,dates,date",
        Inputs: [{
                name: "server",
                tooltip: `IP address or hostname of the server assigned to this node, will be used for API requests.  If you are running nodes within Docker you should use the server IP address rather than the name.

      \\nExample:\\n
       tdarrserver

      \\nExample:\\n
       192.168.1.100`
            }, {
                name: "extensions",
                tooltip: `When files are trans-coded the file extension may change, enter a list of extensions to try and match the original file with in the database after trans-coding. Default is the list of container types from library settings. The list will be searched in order and the extension of the original file will always be checked first before the list is used.

      \\nExample:\\n
       mkv,mp4,avi`
            },
            {
                name: "log",
                tooltip: `Write log entries to console.log. Default is false.

      \\nExample:\\n
       true`
            }
        ]
    };
};

module.exports.plugin = async function plugin(file, librarySettings, inputs) {

    var responseData = {
        file,
        removeFromDB: false,
        updateDB: false,
        infoLog: ""
    };

    try {

        if (inputs.server == undefined || inputs.server.trim() === "") {
            responseData.infoLog += "Tdarr server name/IP not configured in library transcode options\n";
            return responseData;
        }

        var fs = require("fs");
        var path = require("path");
        if (fs.existsSync(path.join(process.cwd(), "/npm"))) {
            var rootModules = path.join(process.cwd(), "/npm/node_modules/");
        } else {
            var rootModules = "";
        }

        var axios = require(rootModules + "axios");
        var utimes = require(rootModules + "utimes");

        log("Waiting 5 seconds...");

        var extensions = inputs.extensions;
        if (extensions == undefined || extensions.trim() === "") {
            extensions = librarySettings.containerFilter;
        }
        extensions = extensions.split(",");

        await new Promise(resolve => setTimeout(resolve, 5000));
        var response = await getFileData(file._id, extensions, inputs.server);

        //log("Got response for " + file._id);
        //log(response.config.data);
        //log(response.data);
        if (response.data.length > 0) {
            //log(response.data[0]);
            log("Changing date...");
            //fs.utimesSync(file._id, new Date(Date.parse(response.data[0].statSync.atime)), new Date(Date.parse(response.data[0].statSync.mtime)));
            await utimes.utimes(file._id, {
                btime: Date.parse(response.data[0].statSync.ctime),
                atime: Date.parse(response.data[0].statSync.atime),
                mtime: Date.parse(response.data[0].statSync.mtime),
            });
            log("Done.");
            responseData.infoLog += "File timestamps updated or match original file\n";
            return responseData;
        }
        responseData.infoLog += "Could not find file using API using " + inputs.server + "\n";
        return responseData;

    } catch (err) {
        log(err);
    }

    async function getFileData(file, extensions, server) {
        var path = require(rootModules + "path-extra");
        var originalExtension = path.extname(file).split(".")[1];
        if (extensions.indexOf(originalExtension) > -1) {
            extensions.splice(extensions.indexOf(originalExtension), 1);
        }
        extensions.unshift(originalExtension);
        var httpResponse = null;
        for (let ext in extensions) {
            filename = path.replaceExt(file, "." + extensions[ext]);
            log("Fetching file object for " + filename + "...");
            httpResponse = await axios.post("http://" + server + ":8265/api/v2/search-db", {
                "data": {
                    "string": filename,
                    "lessThanGB": 10000,
                    "greaterThanGB": 0
                }
            });

            //log(httpResponse.config.data);
            //log(httpResponse.data);
            if (httpResponse.status == 200) {
                if (httpResponse.data.length > 0) {
                    log("Got response for " + filename);
                    //httpResponse._id = filename;
                    return httpResponse;
                } else {
                    log("Response for " + filename + " is empty");
                }
            } else {
                log("API request for " + file + " failed.");
            }
        }
        log("Could not get file info from API, giving up.");
        return httpResponse;
    }

    function log(msg) {
        if (inputs.log === "true") {
            console.log(msg);
        }
    }
};
