var path = require('path'),
    exec = require('child_process').exec,
    fs = require('fs.extra'),
    _ = require('underscore'),
    npm_cmd = "npm pack ";


function generate_full_command(package_folder) {
    return npm_cmd + ' ' + package_folder;
}


function copy_node_dir(from, to, callback) {
    fs.copyRecursive(from, to, callback);
}

function clean_up(dir, tgz_file, callback) {
    async.parallel([
        function(cb) {
            fs.rmrf(dir, cb);
        },
        function(cb) {
            fs.unlink(tgz_file, cb);
        }
    ], callback);


    
}

function read_package_json(package_folder, kanso_json, callback) {
    var package_json = path.join(package_folder, 'package.json');
    fs.readFile(package_json, function(err, content) {
        if (err) return  callback(err);
        var json = {};
        if (content) {
            json = JSON.parse(content);
        }
        callback(null, _.defaults(json, kanso_json));
    });
}

function write_package_json(package_json, package_folder, callback) {
    var package_json_file = path.join(package_folder, 'package.json');
    fs.writeFile(package_json_file, JSON.stringify(package_json), callback);
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
        
        if (!doc._attachments) {
            doc._attachments = {};
        }
        doc._attachments[tgz_name] = {
            'content_type': 'application/octet-stream',
            'data': content.toString('base64')
        };
        callback(null, doc);
    });    
}


function add_node_info(doc, package_json, callback) {
    if (!doc.versions) doc.versions = {};
    doc.versions[package_json.version] = package_json;
    doc['dist-tags'] = {};
    doc['dist-tags'].latest = package_json.version;
    doc.time = {};
    callback(null, doc);
}



module.exports = {
    run : function(root, path_loc, kanso_json, doc, callback) {
        var folder_name = '_node_module';
        var working_folder_name = folder_name + '_working';
        if (kanso_json.node_module_folder) {
            folder_name = kanso_json.node_module_folder;
        }
        var src_folder = path.join(root, folder_name),
            package_folder = path.join(root, working_folder_name),
            generated_package_json,
            expected_tgz_name;
        async.waterfall([
            function(callback) {
                console.log('copy node dir...');
                copy_node_dir(src_folder, package_folder, callback);
            },
            function(callback) {
                console.log('reading package.json...');
                read_package_json(package_folder, kanso_json, callback);
            },
            function(package_json, callback) {
                console.log('writing updated package.json...');
                generated_package_json = package_json;
                write_package_json(package_json, package_folder, callback);
            },
            function(callback) {
                generate_tgz(package_folder, callback);
            },
            function(callback) {
                console.log('packing node module...');
                expected_tgz_name = generate_tgz_name(generated_package_json);
                attach_tgz(expected_tgz_name, doc, callback);
            },
            function(doc, callback) {
                console.log('adding info to ddoc...');
                add_node_info(doc, generated_package_json, callback);
            }
        ], function(err, doc) {
            clean_up(package_folder, expected_tgz_name,  function(err2) {
                callback(err, doc);
            })
        });
    }
}