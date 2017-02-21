# qrcc

Qt resource compiler implemented in node.  

## Install

To use qrcc as an application install it globally:

```
sudo npm install -g qrcc
```

If you're going to use it as a Node.js module within your project:

```
npm install --save qrcc
```

**Note**:
qrcc is able to create binary resource files only.

## Usage

### CLI

```
qrcc inputs [options] -o output
```

Options:

```
 -o, --output           Write output to <file>                
                            [string] [required]
 -r, --root             Prefix resource access path with root path.
                            [string] [default: "/"]
 -c, --compressLevel    Compress input files by <level>.   
                            [number] [default: -1]
 -t, --threshold        Threshold to consider compressing files.
                            [number] [default: 70]
 -n, --noCompress       Disable all compression        
                            [boolean] [default: false]
```

e.g.:

```
$ qrcc ./resource.qrc --noCompress -o resource.rcc
