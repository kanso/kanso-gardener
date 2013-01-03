var path = require('path'),
    exec = require('child_process').exec,
    fs = require('fs'),
    _ = require('underscore'),
    npm_cmd = "npm pack ";


function generate_full_command(package_folder) {
    return npm_cmd + ' ' + package_folder;
}


function read_package_json(package_folder, kanso_json, callback) {
    var package_json = path.join(package_folder, 'package.json');
    fs.readFile(package_json, function(err, content) {
        if (err) callback(err, kanso_json);
        var json = {};
        if (content) {
            json = JSON.parse(content);
        }
        callback(null, _.defaults(json, kanso_json));
    });
}


function generate_tgz_name(package_json) {
    return package_json.name + '-' + package_json.version + '.tgz';
}

function generate_tgz(package_folder, callback) {
    var cmd = generate_full_command(package_folder);
    console.log('running: ' + cmd);

    exec(cmd, function(err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        callback(err);
    });
}


function attach_tgz(tgz_name, doc, callback) {
    fs.readFile(tgz_name, function (err, content) {
        if (err) return callback(err);
        
        var data = content.toString();

        if (!doc._attachments) {
            doc._attachments = {};
        }
        doc._attachments[tgz_name] = {
            'content_type': 'application/octet-stream',
            'data': new Buffer(data).toString('base64')
        };
        callback(null, doc);
    });    
}



module.exports = {
    run : function(root, path_loc, kanso_json, doc, callback) {
        var folder_name = '_node_module';        
        if (kanso_json.node_module_folder) {
            folder_name = kanso_json.node_module_folder;
        }
        var package_folder = path.join(root, folder_name);
        read_package_json(package_folder, kanso_json, function(err, package_json){
            console.log(err, package_json);
            generate_tgz(package_folder, function(err) {
                console.log(package_json);
                var expected_tgz_name = generate_tgz_name(package_json);
                attach_tgz(expected_tgz_name, doc, callback);
            })
        })
    }
}