import sys, zipfile, os
z = zipfile.ZipFile(sys.argv[1]); dest = os.path.abspath(sys.argv[2]); os.makedirs(dest)
for i in z.infolist():
    p = os.path.abspath(os.path.join(dest, i.filename))
    if not p.startswith(dest + os.sep): print("skip", i.filename); continue
    if (i.external_attr >> 16) & 0o170000 == 0o120000: print("skip symlink", i.filename); continue
    z.extract(i, dest)
print(sys.argv[2], len(z.infolist()), "entries")
