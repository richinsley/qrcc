"use strict";
var fs = require('fs');
var htmlparser = require("htmlparser2");
var path = require('path');
var binutils = require('binutils');
var pako = require('pako');
var uint32 = require('uint32');

var qhash = function(key) {
    var retv = 0;
    for (let i = 0; i < key.length; ++i) {
        retv = uint32.shiftLeft(retv, 4) + key.charCodeAt(i);
        retv = uint32.xor(retv, uint32.shiftRight(uint32.and(retv, 0xf0000000), 23));
        retv = uint32.and(retv, 0x0fffffff);
    }
    return retv;
}

var qcompareHash = function(a, b) {
    let ah = qhash(a.m_name);
    let bh = qhash(b.m_name);
    if(ah < bh)
        return -1;
    if(ah > bh)
        return 1;
    return 0;
}

var RCCFileInfo = function(name, fileInfo, language, country, flags, compressLevel, compressThreshold) {
    if (typeof fileInfo === "undefined") fileInfo = null;
    if (typeof language === "undefined") language = 0;
    if (typeof country === "undefined") country = 0;
    if (typeof flags === "undefined") flags = 0;
    if (typeof compressLevel === "undefined") compressLevel = -1;
    if (typeof compressThreshold === "undefined") compressThreshold = 70;

    var mobj = {
        m_flags: flags,
        m_name: name,
        m_language: language,
        m_country: country,
        m_fileInfo: fileInfo,
        m_parent: null,
        m_children: {}, // object of arrays of RCCFileInfo.  We simulate a multi-hash
        m_compressLevel: compressLevel,
        m_compressThreshold: compressThreshold,
        m_nameOffset: 0,
        m_dataOffset: 0,
        m_childOffset: 0,
        insertChild: function(key, value) {
            if(mobj.m_children.hasOwnProperty(key)) {
                mobj.m_children[key].push(value);
            } else {
                mobj.m_children[key] = [value];
            }
        },
        writeDataBlob: function(writer, offset) {
            mobj.m_dataOffset = offset;
            let data = fs.readFileSync(mobj.m_fileInfo.absFileName);

            if(mobj.m_compressLevel && data.length) {
                let compressed = pako.deflate(data, {level: mobj.m_compressLevel});
                let compressRatio = 100.0 * (data.length- compressed.length) / data.length;
                if (compressRatio >= mobj.m_compressThreshold) {
                    data = compressed;
                    mobj.m_flags |= 0x01; // Compressed flag
                }
            }

            writer.WriteUInt32(data.length);
            offset += 4;
            writer.WriteBytes(data);
            offset += data.length;
            return offset;
        },
        writeDataName: function(writer, offset) {
            mobj.m_nameOffset = offset;
            writer.WriteUInt16(mobj.m_name.length);
            offset += 2;

            var hash = qhash(mobj.m_name);
            writer.WriteUInt32(hash);
            offset += 4;

            // write unicode uint16 codes for name
            for (let i = 0; i < mobj.m_name.length; ++i) {
                writer.WriteUInt16(mobj.m_name.charCodeAt(i));
            }
            offset += mobj.m_name.length * 2;
            return offset;
        },
        writeDataInfo: function(writer) {
            // var d = new Date();
            // var n = d.getTime(); <- epoch!!

            var ch = []; // count the kids
            for(let k in mobj.m_children) {
                ch = ch.concat(mobj.m_children[k]);
            }

            if(mobj.m_flags & 0x02) {
                writer.WriteUInt32(mobj.m_nameOffset);
                writer.WriteUInt16(mobj.m_flags);
                writer.WriteUInt32(ch.length);
                writer.WriteUInt32(mobj.m_childOffset);
            } else {
                writer.WriteUInt32(mobj.m_nameOffset);
                writer.WriteUInt16(mobj.m_flags);
                writer.WriteUInt16(mobj.m_country);
                writer.WriteUInt16(1/*mobj.m_language*/); // <- FIX ME!
                writer.WriteUInt32(mobj.m_dataOffset);
            }
            if(!mobj.m_fileInfo) {
                writer.WriteDouble(0);
            } else {
                var d = new Date(mobj.m_fileInfo.mtime);
                writer.WriteDouble(d.getTime());
            }
        }
    };

    return mobj;
}

var lang_code = [
        "ab" ,"om" ,"aa" ,"af" ,"sq" ,"am" ,"ar" ,"hy" ,"as" ,"ay" ,"az" ,
        "ba" ,"eu" ,"bn" ,"dz" ,"bh" ,"bi" ,"br" ,"bg" ,"my" ,"be" ,"km" ,
        "ca" ,"zh" ,"co" ,"hr" ,"cs" ,"da" ,"nl" ,"en" ,"eo" ,"et" ,"fo" ,
        "fj" ,"fi" ,"fr" ,"fy" ,"gd" ,"gl" ,"ka" ,"de" ,"el" ,"kl" ,"gn" ,
        "gu" ,"ha" ,"he" ,"hi" ,"hu" ,"is" ,"id" ,"ia" ,"ie" ,"iu" ,"ik" ,
        "ga" ,"it" ,"ja" ,"jv" ,"kn" ,"ks" ,"kk" ,"rw" ,"ky" ,"ko" ,"ku" ,
        "rn" ,"lo" ,"la" ,"lv" ,"ln" ,"lt" ,"mk" ,"mg" ,"ms" ,"ml" ,"mt" ,
        "mi" ,"mr" ,"mo" ,"mn" ,"na" ,"ne" ,"nb" ,"oc" ,"or" ,"ps" ,"fa" ,
        "pl" ,"pt" ,"pa" ,"qu" ,"rm" ,"ro" ,"ru" ,"sm" ,"sg" ,"sa" ,"sr" ,
        "sh" ,"st" ,"tn", "sn" ,"sd" ,"si" ,"ss" ,"sk" ,"sl" ,"so" ,"es" ,
        "su" ,"sw" ,"sv" ,"tl" ,"tg" ,"ta" ,"tt" ,"te" ,"th" ,"bo" ,"ti" ,
        "to" ,"ts" ,"tr" ,"tk" ,"tw" ,"ug" ,"uk" ,"ur" ,"uz" ,"vi" ,"vo" ,
        "cy" ,"wo" ,"xh" ,"yi" ,"yo" ,"za" ,"zu" ,"nn" ,"bs" ,"dv" ,"gv" ,
        "kw" ,"ak" ,"kok" ,"gaa" ,"ig" ,"kam" ,"syr" ,"byn" ,"gez" ,"kfo" ,
        "sid" ,"cch" ,"tig" ,"kaj" ,"fur" ,"ve" ,"ee" ,"wa" ,"haw" ,"kcg" ,"ny"
    ]

var qrcc_getLanguageCode = function(lang) {    
    return lang_code.indexOf(lang) + 1;
}

var qrcc_processResourceFile = function(filePaths, options) {
    options = options ? options : {};

    if(!options.hasOwnProperty('compressLevel')) {
        options["compressLevel"] = -1;
    }
    if(!options.hasOwnProperty('compressThreshold')) {
        options["compressThreshold"] = 70;
    }
    if(!options.hasOwnProperty('resourceRoot')) {
        options["resourceRoot"] = "";
    }
    if(!options.hasOwnProperty('currentPath')) {
        options['currentPath'] = process.cwd();
    }
    if (options.currentPath != "" && !options.currentPath.endsWith('/'))
        options.currentPath += '/';

    var tokens = [];
    var language = 0;
    var country = 0;
    var compressLevel = -1;
    var compressThreshold = 70;
    var prefix = "";
    var alias = "";
    var root = null;

    // offsets into entries that are stored in the initializer segement of the resource file
    var m_treeOffset = 0;
    var m_dataOffset = 0;
    var m_namesOffset = 0;

    var addFile = function(_alias, _file) {
        // correct slashes
        _alias = _alias.replace(/\\/g, '/');

        if(_file.m_fileInfo.size > 0xffffffff) {
            console.log("File to large: " + _alias);
            return false;
        }

        if(!root) {
            root = RCCFileInfo("", null, 0, 0, 2);
        }
        var parent = root;
        var nodes = _alias.split('/');
        for(let i = 1; i < nodes.length - 1; ++i) {
            let node = nodes[i];
            if(node == "")
                continue;
            if(!parent.m_children.hasOwnProperty(node)) {
                let s = RCCFileInfo(node, null, 0, 0, 2);
                s.m_parent = parent;
                parent.insertChild(node, s);
                parent = s;
            } else {
                parent = parent.m_children[node][0];
            }
        }

        let filename = nodes[nodes.length - 1];
        let s = _file; // no deep-copy
        s.m_parent = parent;
        for(let k in parent.m_children) {
            for(let i = 0; i < parent.m_children[k].length; i++) {
                let value = parent.m_children[k][i];
                if(k == filename && value.m_language == s.m_language && value.m_country == s.m_country) {
                    console.log("potential duplicate alias detected");
                    break;
                }
            }
        }
        parent.insertChild(filename, s);
        return true;
    }

    var writeDataBlobs = function(m_out) {
        m_dataOffset = m_out.Length;
        if(!root) {
            return false;
        }
        let pending = [];
        let offset = 0;
        pending.push(root);
        while(pending.length) {
            let file = pending.pop();
            for(let k in file.m_children) {
                let ca = file.m_children[k];
                for(let i = 0; i < ca.length; i++) {
                    let child = ca[i];
                    if(child.m_flags & 0x02) {
                        pending.push(child);
                    } else {
                        offset = child.writeDataBlob(m_out, offset);
                        if(offset == 0) {
                            return false;
                        }
                    }
                }
            }
        }
        return true;
    }

    var writeDataNames = function(m_out) {
        m_namesOffset = m_out.Length;
        let names = {};
        let pending = [];
        if(!root) {
            return false;
        }
        pending.push(root);
        let offset = 0;
        while(pending.length) {
            let file = pending.pop();
            for(let k in file.m_children) {
                let ca = file.m_children[k];
                for(let i = 0; i < ca.length; i++) {
                    let child = ca[i];
                    if(child.m_flags & 0x02) {
                        pending.push(child);
                    }
                    if(names.hasOwnProperty(child.m_name)) {
                        child.m_nameOffset = names[child.m_name];
                    } else {
                        names[child.m_name] = offset;
                        offset = child.writeDataName(m_out, offset);
                    }
                }
            }
        }
        return true;
    }

    var writeDataStructure = function(m_out) {
        m_treeOffset = m_out.Length;
        let pending = [];
        if(!root) {
            return false;
        }
        pending.push(root);
        let offset = 1;
        while(pending.length) {
            let file = pending.pop();
            file.m_childOffset = offset;
            var m_children = [];
            for(let k in file.m_children) {
                m_children = m_children.concat(file.m_children[k]);
            }
            m_children.sort(qcompareHash);
            for(let i = 0; i < m_children.length; i++) {
                let child = m_children[i];
                ++offset;
                if(child.m_flags & 0x02) {
                    pending.push(child);
                }
            }
        }
        // again, but write this time
        pending.push(root);
        root.writeDataInfo(m_out);
        while(pending.length) {
            let file = pending.pop();
            m_children = [];
            for(let k in file.m_children) {
                m_children = m_children.concat(file.m_children[k]);
            }
            m_children.sort(qcompareHash);
            for(let i = 0; i < m_children.length; i++) {
                let child = m_children[i];
                child.writeDataInfo(m_out);
                if(child.m_flags & 0x02) {
                    pending.push(child);
                }
            }
        }
        return true;
    }

    var parser = new htmlparser.Parser({
        onopentag: function(name, attribs){
            name = name.toLowerCase();
            if(name === "rcc") {
                if(tokens.length) {
                    throw("expected <RCC> tag");
                } else {
                    tokens.push("rcc");
                }
            } else if(name == "qresource") {
                if(!tokens.length || tokens[tokens.length - 1] != "rcc") {
                    throw("unexpected <RESOURCE> tag");
                } else {
                    tokens.push("qresource");
                    language = 0;
                    country = 0;
                    if(attribs.hasOwnProperty("lang")) {
                        language = qrcc_getLanguageCode(attribs["lang"]);
                    }
                    prefix = "";
                    if(attribs.hasOwnProperty("prefix")) {
                        prefix = attribs["prefix"];
                    }
                    if(!prefix.startsWith('/')) {
                        prefix = '/' + prefix;
                    }
                    if(!prefix.endsWith('/')) {
                        prefix += '/';
                    }
                }
            } else if(name == "file") {
                if(!tokens.length || tokens[tokens.length - 1] != "qresource") {
                    throw("unexpected <FILE> tag");
                } else {
                    tokens.push("file")
                    alias = "";
                    if(attribs.hasOwnProperty("alias")) {
                        alias = attribs["alias"];
                    }

                    compressLevel = options.compressLevel;
                    if(attribs.hasOwnProperty("compress")) {
                        compressLevel = attribs["compress"];
                    }
                    compressThreshold = options.compressThreshold;
                    if(attribs.hasOwnProperty("threshold")) {
                        compressThreshold = attribs["threshold"];
                    }
                    if(options.compressLevel == -2) {
                        compressLevel = 0;
                    }
                }
            } else {
                throw("unexpected tag: " + name);
            }
        },
        ontext: function(text){
            if(!text.trim().length) {
                // just whitespace
                return;
            }
            if (!tokens.length || tokens[tokens.length - 1] != "file") {
                throw("unexpected text");
            } else {
                var filename = text;
                if(filename == "") {
                    console.log("Warning: Null node in XML");
                }

                // remove trailing slash while we compute paths
                if(filename.endsWith('\\') || filename.endsWith('/')) {
                    filename = filename.slice(0, -1);
                }
                if(alias == "") {
                    alias = filename;
                }

                alias = path.normalize(alias);
                while(alias.startsWith("../")) {
                    alias = alias.substring(3);
                }
                alias = path.normalize(options.resourceRoot) + prefix + alias;
                if(alias.startsWith('.')) alias = alias.substring(1);
                var absFileName = filename;
                if(!path.isAbsolute(absFileName)) {
                    absFileName = path.join(options.currentPath, absFileName);
                }
                var file = null;
                try {
                    file = fs.lstatSync(absFileName);
                    file.absFileName = absFileName;
                } catch(err) {
                    throw("Cannot find file " + absFileName);
                }

                if(file.isFile()) {
                    var fsec = alias.split('/');
                    fsec = fsec[fsec.length - 1];
                    if(!addFile(alias, RCCFileInfo(fsec, file, language, country, 0, compressLevel, compressThreshold))) {
                        throw("failed to add file " + absFileName);
                    }
                } else {
                    // TODO - add glob support in attribute section
                    if(file.isDirectory()) {
                        var dd = fs.readdirSync(file.absFileName);
                        if(!alias.endsWith('/')) {
                            alias += '/';
                        }
                        for(let i = 0; i < dd.length; i++) {
                            let childPath = path.join(file.absFileName , dd[i]);
                            let child = fs.lstatSync(childPath);
                            child.absFileName = childPath;
                            if(!addFile(path.join(alias , dd[i]), RCCFileInfo(dd[i], child, language, country,
                                                        child.isDirectory() ? 0x02 : 0x00,
                                                        compressLevel, compressThreshold))) {
                                                            throw "failed to add dir child as file";
                            }
                        }
                    } else {
                        throw "unknown file entry type";
                    }
                }
            }
        },
        onclosetag: function(tagname) {
            if(tagname == "rcc") {
                if(tokens.length && tokens[tokens.length - 1] == "rcc")
                    tokens.pop();
                else
                    throw("unexpected closing tag");
            } else if(tagname == "qresource") {
                if(tokens.length && tokens[tokens.length - 1] == "qresource")
                    tokens.pop();
                else
                    throw("unexpected closing tag");
            } else if(tagname == "file") {
                if(tokens.length && tokens[tokens.length - 1] == "file")
                    tokens.pop();
                else
                    throw("unexpected closing tag");
            }
        }
    }, {decodeEntities: true});

    for(let i = 0; i < filePaths.length; i++) {
        parser.write(fs.readFileSync(filePaths[i], 'utf8'));
    }
    
    parser.end();

    // yay - write it
    var writer = new binutils.BinaryWriter();

    // write the header
    // "qres" - have to do this as ascii bytes
    writer.WriteInt8(0x71);
    writer.WriteInt8(0x72);
    writer.WriteInt8(0x65);
    writer.WriteInt8(0x73);
    writer.WriteUInt32(0);
    writer.WriteUInt32(0);
    writer.WriteUInt32(0);
    writer.WriteUInt32(0);

    if(!writeDataBlobs(writer)) {
        throw "failed to write data blob";
    }

    if(!writeDataNames(writer)) {
        throw "Could not write file names";
    }

    if(!writeDataStructure(writer)) {
        throw "Could not write data tree";
    }

    // write the initializer
    // byte[i + 0] version(?)
    var initPos = 4;

    writer.ByteBuffer[initPos++] = 0x00;
    writer.ByteBuffer[initPos++] = 0x00;
    writer.ByteBuffer[initPos++] = 0x00;
    writer.ByteBuffer[initPos++] = 0x02;

    writer.ByteBuffer[initPos++] = uint32.and(uint32.shiftRight(m_treeOffset, 24), 0xff);
    writer.ByteBuffer[initPos++] = uint32.and(uint32.shiftRight(m_treeOffset, 16), 0xff);
    writer.ByteBuffer[initPos++] = uint32.and(uint32.shiftRight(m_treeOffset, 8), 0xff);
    writer.ByteBuffer[initPos++] = uint32.and(uint32.shiftRight(m_treeOffset, 0), 0xff);

    writer.ByteBuffer[initPos++] = uint32.and(uint32.shiftRight(m_dataOffset, 24), 0xff);
    writer.ByteBuffer[initPos++] = uint32.and(uint32.shiftRight(m_dataOffset, 16), 0xff);
    writer.ByteBuffer[initPos++] = uint32.and(uint32.shiftRight(m_dataOffset, 8), 0xff);
    writer.ByteBuffer[initPos++] = uint32.and(uint32.shiftRight(m_dataOffset, 0), 0xff);

    writer.ByteBuffer[initPos++] = uint32.and(uint32.shiftRight(m_namesOffset, 24), 0xff);
    writer.ByteBuffer[initPos++] = uint32.and(uint32.shiftRight(m_namesOffset, 16), 0xff);
    writer.ByteBuffer[initPos++] = uint32.and(uint32.shiftRight(m_namesOffset, 8), 0xff);
    writer.ByteBuffer[initPos++] = uint32.and(uint32.shiftRight(m_namesOffset, 0), 0xff);

    return writer.ByteBuffer;
}

module.exports = {
    qrcc_processResourceFile: qrcc_processResourceFile
}