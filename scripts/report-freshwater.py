"""Compare independently rendered masks with the stored reference annotations."""
from PIL import Image, ImageOps, ImageDraw, ImageFont
from pathlib import Path
import json
import numpy as np
import hashlib, struct, shutil, sys

root=Path('.local/freshwater-v1');refs=Path('design/reference/freshwater')
qa=json.loads((root/'qa.json').read_text()); results=[]
def tight(im):
    im=im.convert('L');box=im.getbbox()
    if box is None: raise RuntimeError('Empty silhouette')
    return im.crop(box)
for item in qa['metrics']:
    id=item['id'];reference=tight(Image.open(refs/'crops'/f'{id}-mask.png'))
    scores={};landmark_error=[]
    for name in ['mask','low-mask']:
        full=Image.open(root/'renders'/id/f'{name}.png').getchannel('A').point(lambda p:255 if p>127 else 0)
        actual=tight(full)
        actual=actual.resize(reference.size,Image.Resampling.NEAREST)
        a=np.array(actual)>127;r=np.array(reference)>127
        scores[name]=float((a&r).sum()/(a|r).sum())
        if name=='mask':
            guides=json.loads(Path('apps/client/src/art/freshwater-guides.json').read_text())[id]
            bounds=full.getbbox();w=bounds[2]-bounds[0];h=bounds[3]-bounds[1]
            for key,pt in item.get('landmarks',{}).items():
                target=guides[key]
                # Normalize through the independently rendered silhouette bounds.
                observed=[(pt[0]-bounds[0])/w,(pt[1]-bounds[1])/h*(reference.height/reference.width)]
                landmark_error.append(float(np.linalg.norm(np.array(observed)-np.array(target[:2]))))
            overlay=np.zeros((*r.shape,3),dtype='uint8');overlay[:]=[255,244,229];overlay[r]=[238,161,122];overlay[a]=[103,166,188];overlay[r&a]=[113,139,116]
            Image.fromarray(overlay).save(root/'renders'/id/'overlay.png')
    mean_error=float(np.mean(landmark_error)) if landmark_error else None
    results.append({'id':id,'silhouetteIoU':scores['mask'],'lowSilhouetteIoU':scores['low-mask'],'meanLandmarkError':mean_error,'passed':scores['mask']>=.95 and mean_error is not None and mean_error<=.02})
    # A contact sheet shows source, canonical view, reverse, top and front/rear.
    sheet=Image.new('RGB',(1500,780),'#fff4e5');draw=ImageDraw.Draw(sheet);draw.text((15,10),id,fill='#513d28')
    sources=[refs/'crops'/f'{id}.png']+[root/'renders'/id/f'{view}.png' for view in ['reference','opposite','top','front','rear']]
    for j,path in enumerate(sources):
        im=Image.open(path).convert('RGB');im=ImageOps.contain(im,(480,340));x=(j%3)*500+(500-im.width)//2;y=(j//3)*380+40+(340-im.height)//2;sheet.paste(im,(x,y));draw.text(((j%3)*500+15,(j//3)*380+25),['Source','Reference view','Opposite','Top','Front','Rear'][j],fill='#513d28')
    sheet.save(root/'renders'/id/'comparison.png')
qa['silhouettes']=results;qa['silhouettePassed']=all(r['passed'] for r in results)
assets=[]
manifest=json.loads(Path('apps/client/public/assets/starter/asset_manifest.json').read_text())
for item in manifest['assets']:
    if item.get('source')!='apps/client/src/art/freshwater-author.ts':continue
    file=Path('apps/client/public/assets/starter')/item['file'];data=file.read_bytes();length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);lods={}
    for name in ['high','low']:
        group=next(n for n in doc['nodes'] if n.get('name')=='fish-lod-'+name)
        meshes=[doc['meshes'][doc['nodes'][i]['mesh']] for i in group.get('children',[]) if 'mesh' in doc['nodes'][i]]
        lods[name]={'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in meshes for p in m['primitives']),'drawCalls':sum(len(m['primitives']) for m in meshes)}
    thumbnail=Path('apps/client/public/assets/starter')/item['thumbnail']
    assets.append({'model':item['id'],'bytes':len(data),'thumbnailBytes':thumbnail.stat().st_size,'sha256':hashlib.sha256(data).hexdigest(),'lods':lods})
qa['assets']=assets;qa['totalFreshwaterBytes']=sum(a['bytes']+a['thumbnailBytes'] for a in assets)
qa['budgetPassed']=len(assets)==15 and qa['totalFreshwaterBytes']<=32000000 and all(a['bytes']<2000000 and a['lods']['high']['triangles']<=20000 and a['lods']['low']['triangles']<=4000 and all(l['drawCalls']<=4 for l in a['lods'].values()) for a in assets)
qa['performancePassed']=len(qa['performance'])==6 and all(p['medianRatio']<=1.1 and p['p95Ratio']<=1.1 for p in qa['performance'])
qa['seaUnchanged']=len(qa['sea'])==50 and all(s['unchanged'] for s in qa['sea'])
qa['passed']=qa['silhouettePassed'] and qa['budgetPassed'] and qa['performancePassed'] and qa['seaUnchanged'] and not qa['errors']
names={'perch':'Cá rô','crucian':'Cá diếc','carp':'Cá chép','pangasius':'Cá tra','catfish':'Cá trê','koi':'Cá koi Showa','tilapia':'Cá rô phi','grasscarp':'Cá trắm cỏ','bigheadcarp':'Cá mè hoa','blackcarp':'Cá trắm đen','snakehead':'Cá lóc bông','giantcatfish':'Cá tra dầu','arapaima':'Cá hải tượng','marbled_eel':'Cá chình bông','sturgeon':'Cá tầm'}
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
overview=Image.new('RGB',(1200,1560),'#fff4e5');draw=ImageDraw.Draw(overview)
draw.text((20,14),'Fishing World — 15 model cá nước ngọt',font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',26),fill='#513d28')
for j,item in enumerate(qa['metrics']):
    im=ImageOps.contain(Image.open(root/'renders'/item['id']/'reference.png').convert('RGB'),(400,270));overview.paste(im,((j%3)*400,(j//3)*300+50));draw.text(((j%3)*400+12,(j//3)*300+320),names[item['id']],font=font,fill='#513d28')
overview.save(root/'overview.png')
(root/'report.json').write_text(json.dumps(qa,indent=2)+'\n')
print(json.dumps(results,indent=2));print('All high LOD silhouettes >=95%:',qa['silhouettePassed'])
print('Budget:',qa['budgetPassed'],'Performance:',qa['performancePassed'],'Sea unchanged:',qa['seaUnchanged'],'Overall:',qa['passed'])
if '--publish' in sys.argv:
    if not qa['passed']:raise SystemExit('QA gate failed; local report retained, publication stopped.')
    dest=Path('docs/images/freshwater');dest.mkdir(parents=True,exist_ok=True)
    shutil.copy2(root/'overview.png',dest/'overview.png')
    for result in results:shutil.copy2(root/'renders'/result['id']/'comparison.png',dest/(result['id']+'.png'))
    video=Path('docs/video');video.mkdir(exist_ok=True);shutil.copy2(root/'turntable.webm',video/'freshwater-turntable.webm')
    validation=Path('docs/validation');validation.mkdir(exist_ok=True);shutil.copy2(root/'report.json',validation/'freshwater-models.json')
