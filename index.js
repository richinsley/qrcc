#!/usr/bin/env node
var qrcc = require('./qrcc.js').qrcc_processResourceFile;
var fs = require('fs');
var argv = require('yargs')
    .usage("Usage: qrcc inputs [options] -o output")
    .demandCommand(1)
    .demandOption('o')
    .alias('o', 'output')
    .describe('o', 'Write output to <file>')
    .string('o')

    .alias('r', 'root')
    .default('r', '/')
    .describe('r', 'Prefix resource access path with root path.')
    .string('r')

    .alias('c', 'compressLevel')
    .describe('c', 'Compress input files by <level>.')
    .number('c')
    .default('c', -1)

    .alias('t', 'threshold')
    .describe('t', 'Threshold to consider compressing files.')
    .number('t')
    .default('t', 70)

    .alias('n', 'noCompress')
    .describe('n', 'Disable all compression')
    .boolean('n')
    .default('n', false)
    .argv;

if(argv.root.constructor === Array) {
    argv.root = argv.root[argv.root.length - 1];
}

if(argv.output.constructor === Array) {
    argv.output = argv.output[argv.output.length - 1];
}

var opts = {
    compressLevel: argv.noCompress ? -2 : argv.compressLevel,
    compressThreshold: argv.threshold,
    resourceRoot: argv.root
}

var retv = 0;
try {
    var buffer = qrcc(argv._, opts);
    fs.writeFileSync(argv.output, buffer);
    console.log("wrote " + buffer.length + " bytes to " + argv.output);
} catch(err) {
    console.log(err);
    retv = 1;
}
process.exit(retv);


