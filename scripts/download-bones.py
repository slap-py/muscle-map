import urllib.request, pathlib, hashlib, json, zipfile
root=pathlib.Path('assets/source'); rev='b722f392d2b09d21f0527229fe1338f27a3bc04e'
base=f'https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/{rev}/'
files=[]
for name in ['License.txt','Readme.md','Z-Anatomy.zip']:
    out=root/('Z-Anatomy-'+name if name!='Z-Anatomy.zip' else name)
    urllib.request.urlretrieve(base+name,out)
    files.append({'path':str(out),'url':base+name,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size})
    print(name,out.stat().st_size,flush=True)
with zipfile.ZipFile(root/'Z-Anatomy.zip') as z:
    print(z.namelist(),flush=True)
    for name in z.namelist():
        if name.endswith('.blend'):
            out=root/pathlib.PurePosixPath(name).name
            out.write_bytes(z.read(name))
            files.append({'path':str(out),'archiveMember':name,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size})
(root/'source-manifest.json').write_text(json.dumps({'revision':rev,'downloaded':'2026-10-04','files':files},indent=2))
