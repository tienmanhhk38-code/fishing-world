"""Extract authored silhouettes/landmarks from the supplied boards (Pillow + numpy).
The source PNGs are immutable; these masks contain geometry guides, not model textures.
Run from repository root with the bundled Python runtime.
"""
from pathlib import Path
import sys
sys.path.insert(0, str(Path('.local/freshwater-tools').resolve()))
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
import json
import cv2

ROOT = Path('design/reference/freshwater')
# id, board, crop, eye (x,y,r), mouth (x,y), body samples (x,top,bottom)
ROWS = [
 ('perch',1,[300,85,930,384],[387,246,18],[324,267],[[321,239,274],[370,195,313],[450,164,343],[550,157,351],[650,173,344],[745,210,318],[795,237,284]]),
 ('crucian',1,[305,385,905,697],[389,558,18],[330,584],[[326,552,588],[380,500,633],[460,457,661],[550,446,674],[650,474,655],[730,520,608],[770,544,581]]),
 ('carp',1,[282,697,995,983],[382,839,18],[307,867],[[300,844,880],[355,797,912],[440,759,939],[550,744,945],[650,768,932],[760,798,905],[838,824,868]]),
 ('tilapia',1,[306,982,961,1274],[407,1133,18],[338,1158],[[328,1130,1166],[380,1080,1203],[460,1047,1226],[560,1040,1236],[660,1063,1228],[740,1094,1193],[795,1120,1166]]),
 ('pangasius',1,[273,1274,1006,1536],[375,1417,18],[309,1440],[[298,1417,1451],[360,1377,1485],[445,1351,1498],[555,1343,1500],[665,1358,1481],[770,1383,1458],[840,1397,1434]]),
 ('catfish',2,[215,128,1010,383],[396,256,18],[291,271],[[280,250,293],[350,210,326],[450,187,343],[570,185,346],[710,200,335],[845,224,311],[900,237,287]]),
 ('grasscarp',2,[280,394,1010,686],[369,554,17],[309,576],[[300,554,583],[360,511,618],[440,481,640],[550,469,651],[670,488,635],[790,514,611],[870,536,582]]),
 ('bigheadcarp',2,[293,690,1010,968],[389,873,18],[315,797],[[308,784,832],[350,768,897],[440,747,934],[550,754,938],[665,784,914],[785,808,890],[871,815,863]]),
 ('koi',2,[280,956,1005,1275],[385,1137,18],[310,1162],[[298,1127,1170],[360,1081,1210],[450,1046,1232],[550,1045,1245],[665,1065,1235],[785,1094,1208],[861,1119,1177]]),
 ('blackcarp',2,[274,1274,1010,1536],[370,1417,17],[294,1440],[[283,1417,1453],[345,1376,1483],[440,1349,1501],[550,1344,1504],[665,1362,1489],[785,1385,1466],[875,1400,1441]]),
 ('snakehead',3,[272,128,1023,374],[365,235,17],[295,263],[[288,231,269],[350,201,301],[450,180,326],[560,178,334],[680,187,329],[790,206,310],[920,226,287]]),
 ('marbled_eel',3,[257,379,1018,640],[334,520,14],[278,541],[[269,513,546],[330,483,566],[420,465,583],[520,496,609],[620,477,589],[720,443,555],[820,455,547],[910,505,567],[983,535,558]]),
 ('giantcatfish',3,[276,650,1023,968],[369,826,17],[301,853],[[290,820,867],[350,786,910],[450,759,941],[555,760,949],[680,778,929],[795,802,899],[870,813,870]]),
 ('arapaima',3,[211,969,1023,1237],[316,1091,16],[231,1110],[[225,1088,1124],[300,1056,1156],[410,1022,1178],[530,1011,1184],[655,1016,1180],[780,1042,1164],[918,1080,1138]]),
 ('sturgeon',3,[195,1240,1023,1535],[353,1385,17],[242,1403],[[229,1378,1408],[300,1362,1431],[385,1327,1456],[500,1320,1466],[640,1334,1457],[780,1363,1437],[882,1383,1416]]),
]

def largest(mask):
    # Flood-fill components without an additional scientific dependency.
    h,w = mask.shape; seen = np.zeros_like(mask); best=[]
    for y,x in zip(*np.nonzero(mask)):
        if seen[y,x]: continue
        stack=[(y,x)]; seen[y,x]=True; points=[]
        while stack:
            yy,xx=stack.pop();points.append((yy,xx))
            for dy,dx in [(1,0),(-1,0),(0,1),(0,-1)]:
                ny,nx=yy+dy,xx+dx
                if 0<=ny<h and 0<=nx<w and mask[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx]=True;stack.append((ny,nx))
        if len(points)>len(best): best=points
    result=np.zeros_like(mask)
    for y,x in best: result[y,x]=True
    return result

out={}
FEATURES={
 'perch':([474,253],[474,285]),'crucian':([465,558],[465,610]),
 'carp':([454,840],[461,870]),'tilapia':([482,1136],[492,1170]),
 'pangasius':([430,1420],[449,1462]),'catfish':([482,254],[491,293]),
 'grasscarp':([445,557],[443,590]),'bigheadcarp':([452,837],[463,869]),
 'koi':([448,1134],[452,1168]),'blackcarp':([431,1414],[436,1453]),
 'snakehead':([444,237],[447,268]),'marbled_eel':([371,515],[355,540]),
 'giantcatfish':([438,826],[444,867]),'arapaima':([365,1095],[354,1125]),
 'sturgeon':([396,1390],[401,1432])}
(ROOT/'crops').mkdir(exist_ok=True)
for id,board,crop,eye,mouth,body in ROWS:
    cv2.setRNGSeed(7)
    image=Image.open(ROOT/'boards'/f'{board:02}.png').convert('RGB').crop(crop)
    a=np.array(image).astype(float)
    # Warm near-white poster and soft cast shadows are excluded; pale skin is
    # recovered by filling the closed outer contour, including the white koi.
    labels=np.full(a.shape[:2],cv2.GC_PR_FGD,dtype='uint8')
    labels[(a[:,:,0]>241)&(a[:,:,1]>222)&(a[:,:,2]>199)]=cv2.GC_BGD
    labels[(a[:,:,0]<170)|(a[:,:,1]<140)|(a[:,:,2]<105)]=cv2.GC_FGD
    labels[:2]=labels[-2:]=cv2.GC_BGD; labels[:,:2]=labels[:,-2:]=cv2.GC_BGD
    cv2.grabCut(np.array(image),labels,None,np.zeros((1,65)),np.zeros((1,65)),5,cv2.GC_INIT_WITH_MASK)
    raw=(labels==cv2.GC_FGD)|(labels==cv2.GC_PR_FGD)
    raw=cv2.morphologyEx(raw.astype('uint8'),cv2.MORPH_CLOSE,np.ones((5,5),dtype='uint8'))>0
    mask=Image.fromarray((largest(raw)*255).astype('uint8'))
    inv=Image.eval(mask,lambda v:255-v);ImageDraw.floodfill(inv,(0,0),128)
    filled=np.array(inv)!=128
    mask=Image.fromarray((filled*255).astype('uint8')).filter(ImageFilter.MinFilter(3))
    if id=='koi':
        # The white Showa patches have poster-colored pixels: explicitly trace
        # the outside contour rather than letting color segmentation eat them.
        outline=[(293,1136),(319,1101),(374,1061),(442,1035),(482,992),(547,970),(590,999),(640,1020),(710,1048),(785,1087),(840,1105),(887,1060),(937,1026),(973,1020),(962,1062),(926,1114),(914,1136),(947,1183),(966,1215),(928,1216),(876,1195),(840,1175),(802,1207),(731,1232),(632,1246),(529,1244),(436,1233),(359,1213),(317,1185),(293,1159)]
        points=[]
        for j,b in enumerate(outline):
            a=outline[(j-1)%len(outline)];c=outline[(j+1)%len(outline)];d=outline[(j+2)%len(outline)]
            for t in np.linspace(0,1,12,endpoint=False):
                points.append(tuple(.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)-crop[k] for k in range(2)))
        mask=Image.new('L',image.size);ImageDraw.Draw(mask).polygon(points,fill=255)
    # Use a tight bounding rectangle for normalization and reproducible alignment.
    bbox=mask.getbbox(); image=image.crop(bbox); mask=mask.crop(bbox)
    origin=[crop[0]+bbox[0],crop[1]+bbox[1]];w,h=image.size
    image.save(ROOT/'crops'/f'{id}.png');mask.save(ROOT/'crops'/f'{id}-mask.png')
    # Thin silhouettes/whiskers are kept in the 512-column source guide.
    mw=512;mh=round(h/w*mw)
    small=np.array(mask.resize((mw,mh),Image.Resampling.BILINEAR))>120
    runs=[]
    for row in small:
        edges=np.flatnonzero(np.diff(np.r_[False,row,False])).tolist()
        runs.append(edges)
    def point(p): return [round((p[0]-origin[0])/w,6),round((p[1]-origin[1])/w,6)]
    patches=[]
    if id in ['koi','bigheadcarp','snakehead','marbled_eel']:
        rgb_array=np.array(image);hsv=cv2.cvtColor(rgb_array,cv2.COLOR_RGB2HSV)
        red=(rgb_array[:,:,0]>rgb_array[:,:,1]*1.45)&(rgb_array[:,:,1]<160)&(hsv[:,:,1]>130)
        masks=[('#e65c30',red),('#39363b',(rgb_array.max(axis=2)<156)&~red)] if id=='koi' else [('#64646c' if id=='bigheadcarp' else '#4f5757' if id=='snakehead' else '#746044',rgb_array.mean(axis=2)<(141 if id=='bigheadcarp' else 135 if id=='snakehead' else 125))]
        for color,region in masks:
            region=(region&(np.array(mask)>127)).astype('uint8')
            region=cv2.morphologyEx(region,cv2.MORPH_OPEN,np.ones((3,3),dtype='uint8'))
            contours,_=cv2.findContours(region,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
            for contour in contours:
                if cv2.contourArea(contour)<65:continue
                outline=cv2.approxPolyDP(contour,1.4,True).reshape(-1,2)
                patches.append({'color':color,'outline':[[round(float(x)/w,6),round(float(y)/w,6)] for x,y in outline]})
    out[id]={'board':board,'crop':crop,'bounds':[origin[0],origin[1],w,h],
        'eye':point(eye)+[round(eye[2]/w,6)],'mouth':point(mouth),'gill':point(FEATURES[id][0]),'pectoral':point(FEATURES[id][1]),
        'body':[[round((x-origin[0])/w,6),round((t-origin[1])/w,6),round((b-origin[1])/w,6)] for x,t,b in body],
        'width':mw,'height':mh,'rows':runs,'pigmentPatches':patches}
Path('apps/client/src/art/freshwater-guides.json').write_text(json.dumps(out,separators=(',',':'))+'\n',encoding='utf8')
(ROOT/'references.json').write_text(json.dumps({id:{k:v for k,v in item.items() if k not in ['rows','width','height']} for id,item in out.items()},indent=2)+'\n',encoding='utf8')
print('Prepared',len(out),'immutable-reference crops and silhouette guides.')
