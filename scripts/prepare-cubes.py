#!/usr/bin/env python3
"""Prepare reproducible PPV cubes and a real THINGS + Legacy Surveys example.

Run with the project's Python containing numpy, astropy and Pillow.
No game packaging or publication is performed.
"""
from pathlib import Path
import argparse, gzip, hashlib, json, math, re, urllib.request, warnings
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from astropy.visualization import make_lupton_rgb
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'cubes'
RAW = ROOT / 'data' / 'raw'
SOURCE = 'https://things.www3.mpia.de//Data_files/DDO154_NA_CUBE_THINGS.FITS'
OPTICAL = ('https://www.legacysurvey.org/viewer/fits-cutout?ra=193.520833333&dec=27.1538888889'
           '&layer=ls-dr9&pixscale=3&size=512&bands=grz')

def download(url, destination):
    if destination.exists() and destination.stat().st_size > 10000:
        print('Using existing', destination.name, flush=True)
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp = destination.with_suffix(destination.suffix + '.part')
    print('Downloading', destination.name, flush=True)
    with urllib.request.urlopen(url, timeout=45) as response, temp.open('wb') as output:
        total = 0
        while True:
            chunk = response.read(2 * 1024 * 1024)
            if not chunk: break
            output.write(chunk); total += len(chunk)
            if total % (32 * 1024 * 1024) == 0:
                print(destination.name, f'{total / 1024**2:.0f} MiB', flush=True)
    temp.replace(destination)
    return destination

def blur(array, sigma):
    if sigma < .05: return array.copy()
    radius = int(math.ceil(sigma * 4))
    x = np.arange(-radius, radius + 1)
    kernel = np.exp(-.5 * (x / sigma)**2); kernel /= kernel.sum()
    result = np.apply_along_axis(lambda a: np.convolve(a, kernel, mode='same'), -1, array)
    return np.apply_along_axis(lambda a: np.convolve(a, kernel, mode='same'), -2, result)

def robust_sigma(array):
    sample = array[np.isfinite(array)]
    if sample.size == 0: return 1e-6
    middle = np.median(sample)
    return float(max(1e-8, 1.4826 * np.median(np.abs(sample - middle))))

def write_dataset(meta, cube, optical, header, clean=None):
    """FITS stays in scientific axis order; browser binary is velocity ascending, north up."""
    directory = OUT / meta['id']; directory.mkdir(parents=True, exist_ok=True)
    velocities = np.array(meta['velocities'], dtype=np.float64)
    order = np.argsort(velocities)
    browser = np.asarray(cube[order, ::-1, :], dtype='<f4')
    meta['velocities'] = velocities[order].tolist()
    meta['shape'] = list(browser.shape)
    meta['arrayOrder'] = 'velocity,y,x; little-endian float32; image row zero is north'
    meta['cubeFile'] = 'cube.f32.gz'
    meta['opticalFile'] = 'optical.png'
    meta['fitsFile'] = 'cube.fits'
    if clean is not None:
        meta['noiselessFile'] = 'noiseless.f32.gz'
        channel_max = float(np.max(clean))
        meta['displayScale'] = {'channel':channel_max,'moment0':float(np.max(np.sum(clean,axis=0))*abs(velocities[1]-velocities[0])),'spectrum':max(channel_max*1.2,.009)}
        with gzip.open(directory / meta['noiselessFile'], 'wb', compresslevel=6) as f:
            f.write(np.asarray(clean[order, ::-1, :], dtype='<f4').tobytes())
    meta['rms'] = robust_sigma(np.concatenate([browser[:5].ravel(), browser[-5:].ravel()]))
    meta['processedSha256'] = hashlib.sha256(browser.tobytes()).hexdigest()
    meta['preparedOn'] = '2026-10-14'
    with gzip.open(directory / 'cube.f32.gz', 'wb', compresslevel=6) as f: f.write(browser.tobytes())
    optical = np.asarray(optical)
    assert optical.shape[:2] == cube.shape[1:], (optical.shape, cube.shape)
    Image.fromarray(optical[::-1].astype(np.uint8)).save(directory / 'optical.png')
    header = header.copy(); header['BUNIT'] = 'Jy/beam'
    fits.PrimaryHDU(np.asarray(cube, dtype='float32'), header).writeto(directory / 'cube.fits', overwrite=True, checksum=True)
    if clean is not None:
        fits.PrimaryHDU(np.asarray(clean, dtype='float32'), header).writeto(directory / 'noiseless-model.fits', overwrite=True, checksum=True)
    (directory / 'metadata.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    # Integrated map for a quick scientific QA view, derived from the exact stored cube.
    mask = np.isfinite(browser) & (browser > 3 * meta['rms'])
    moment0 = np.sum(np.where(mask, browser, 0) * np.gradient(np.sort(velocities))[:,None,None], axis=0)
    scaled = np.arcsinh(moment0 / max(np.percentile(moment0, 98), 1e-9) * 8) / np.arcsinh(8)
    scaled = np.clip(scaled, 0, 1)
    palette = np.array(json.loads((ROOT/'src'/'inferno.json').read_text()), dtype=np.uint8)
    Image.fromarray(palette[np.rint(scaled*255).astype(int)]).save(directory / 'moment0-preview.png')
    print('Prepared', meta['id'], meta['shape'], 'RMS', meta['rms'], flush=True)
    return {k:meta[k] for k in ['id','title','kind','description','shape','rms']}

def synthetic(disturbed=False):
    n = 128; nv = 101; pix = 4.; beam = 16.; distance = 8.
    velocity = np.arange(nv)*5.-250.
    yy, xx = np.mgrid[:n,:n]
    x = (xx-(n-1)/2)*pix*distance*1000/206265
    y = (yy-(n-1)/2)*pix*distance*1000/206265
    inc = np.deg2rad(56.); pa = np.deg2rad(28.)
    xp = x*np.cos(pa)+y*np.sin(pa); yp = (-x*np.sin(pa)+y*np.cos(pa))/np.cos(inc)
    radius = np.hypot(xp,yp); theta=np.arctan2(yp,xp)
    sigma=9.
    jy_per_k=1.42040575**2*beam**2/1.222e6
    # Forward-project tilted rings, including both geometry and kinematics of the warp.
    # Ring cell mass / sky pixel area produces projected column density without an extra cos(i).
    radii=np.linspace(.045,7.1,90);azimuth=np.linspace(0,2*np.pi,512,endpoint=False)
    rr,phi=np.meshgrid(radii,azimuth,indexing='ij');dr=radii[1]-radii[0];dphi=2*np.pi/512
    outer=np.clip((rr-3)/3.5,0,1)
    local_inc=inc+(np.deg2rad(11)*outer if disturbed else 0)
    local_pa=pa+(np.deg2rad(24)*outer if disturbed else 0)
    sky_x=rr*np.cos(phi)*np.cos(local_pa)-rr*np.sin(phi)*np.cos(local_inc)*np.sin(local_pa)
    sky_y=rr*np.cos(phi)*np.sin(local_pa)+rr*np.sin(phi)*np.cos(local_inc)*np.cos(local_pa)
    los=145*(1-np.exp(-rr/1.1))*np.sin(local_inc)*np.cos(phi)
    surface=7*np.exp(-rr/3)*(1+.24*np.cos(2*phi-2.7*rr))
    surface*=1-np.exp(-(rr/.55)**2)
    surface*=1/(1+np.exp((rr-6.4)/.38))
    pixel_kpc=pix*distance*1000/206265
    column=surface*rr*dr*dphi/pixel_kpc**2*1.25e20
    amplitude=(column/(1.823e18*sigma*np.sqrt(2*np.pi))*jy_per_k).ravel()
    px=(sky_x/pixel_kpc+(n-1)/2).ravel();py=(sky_y/pixel_kpc+(n-1)/2).ravel()
    ix=np.floor(px).astype(int);iy=np.floor(py).astype(int);fx=px-ix;fy=py-iy
    cube=np.zeros((nv,n,n),dtype='float64')
    for ox,oy,weight in [(0,0,(1-fx)*(1-fy)),(1,0,fx*(1-fy)),(0,1,(1-fx)*fy),(1,1,fx*fy)]:
        good=(ix+ox>=0)&(ix+ox<n)&(iy+oy>=0)&(iy+oy<n)
        for k,v in enumerate(velocity):
            value=amplitude*weight*np.exp(-.5*((v-los.ravel())/sigma)**2)
            np.add.at(cube[k],(iy[good]+oy,ix[good]+ox),value[good])
    if disturbed:
        # A phenomenological gas tail with a coherent velocity gradient, not a dynamical simulation.
        for t in np.linspace(0,1,70):
            tx=2.5+4.3*t; ty=1.1+1.7*t+.5*np.sin(t*np.pi)
            amp=.00040*np.exp(-.5*t)*np.exp(-((x-tx)**2+(y-ty)**2)/(.35**2*2))
            cube+=amp[None]*np.exp(-.5*((velocity[:,None,None]-(75+52*t))/12)**2)/2.8
        # A weak, offset cloud: discovery must be verified in several velocity channels.
        cloud=.0012*np.exp(-((x+4.3)**2+(y-2.6)**2)/(.42**2*2))
        cube+=cloud[None]*np.exp(-.5*((velocity[:,None,None]+58)/8)**2)
    spectral_kernel=np.exp(-.5*(np.arange(-2,3)/.5)**2);spectral_kernel/=spectral_kernel.sum()
    clean=blur(cube,beam/(2.35482*pix))
    clean=np.apply_along_axis(lambda a:np.convolve(a,spectral_kernel,mode='same'),0,clean).astype('float32')
    random=np.random.default_rng(2102 if disturbed else 2101)
    noise=blur(random.normal(size=cube.shape),beam/(2.35482*pix))
    noise=np.apply_along_axis(lambda a:np.convolve(a,spectral_kernel,mode='same'),0,noise)
    noise*=.00011/robust_sigma(noise)
    observed=(clean+noise).astype('float32')
    stellar=np.exp(-radius/1.4)*(1+.35*np.cos(2*theta-3.7*radius))
    stellar*=1/(1+np.exp((radius-3.7)/.25))
    image=np.zeros((n,n,3),float)
    for channel,color in enumerate([1.,.85,.64]): image[:,:,channel]=np.arcsinh(stellar*9)/np.arcsinh(9)*color
    for _ in range(40):
        sx,sy=random.uniform(0,n,2); star=np.exp(-((xx-sx)**2+(yy-sy)**2)/(2*.3**2))*random.uniform(.2,.6)
        image+=star[:,:,None]
    image=np.uint8(np.clip(image,0,1)*255)
    w=WCS(naxis=3); w.wcs.ctype=['RA---TAN','DEC--TAN','VRAD']; w.wcs.cunit=['deg','deg','m/s']
    w.wcs.crpix=[(n+1)/2,(n+1)/2,1]; w.wcs.crval=[180.,0.,velocity[0]*1000]; w.wcs.cdelt=[-pix/3600,pix/3600,5000]
    h=w.to_header(); h['RESTFRQ']=1.42040575e9; h['BMAJ']=beam/3600; h['BMIN']=beam/3600; h['BPA']=0.
    h['OBJECT']='SYNTHETIC'; h['HISTORY']='Parametric teaching PPV model; not hydrodynamical evolution.'
    meta={
        'id':'sim-disturbed' if disturbed else 'sim-disk',
        'title':'扰动星系实验场' if disturbed else '旋转盘实验场', 'kind':'simulation',
        'description':'带外盘翘曲、弱气体尾与独立云团的合成观测。' if disturbed else '含螺旋结构、有限波束与相关噪声的旋转盘合成观测。',
        'unit':'Jy/beam','velocityConvention':'模型射电视向速度；系统速度为 0 km/s','vsys':0.,
        'velocities':velocity.tolist(),'pixelScaleArcsec':pix,'beamMajorArcsec':beam,'beamMinorArcsec':beam,
        'fieldArcmin':n*pix/60,'distanceMpc':distance,
        'sources':[{'title':'本项目参数化 PPV 模型','url':'','credit':'程序生成；不对应真实天体'}],
        'processing':['倾斜圆环前向投影，按每个圆环的几何和视向速度生成 PPV','空间 Gaussian FWHM 16 arcsec','通道间隔 5 km/s；局部弥散 9 km/s；谱响应 Gaussian sigma 0.5 channel','空间与谱轴相关噪声 RMS 0.11 mJy/beam','第三轴是速度，不是空间深度'],
        'knownParameters':{'maxRotationKmS':145,'innerInclinationDeg':56,'screenLineOfNodesDeg':28,'outerWarpInclinationDeg':11 if disturbed else 0,'outerWarpLineOfNodesDeg':24 if disturbed else 0,'tail':disturbed},
    }
    return write_dataset(meta,observed,image,h,clean)

def bilinear(image, x, y):
    h,w=image.shape; x0=np.floor(x).astype(int); y0=np.floor(y).astype(int)
    good=np.isfinite(x)&np.isfinite(y)&(x0>=0)&(x0<w-1)&(y0>=0)&(y0<h-1)
    x0=np.clip(x0,0,w-2); y0=np.clip(y0,0,h-2); dx=x-x0;dy=y-y0
    result=image[y0,x0]*(1-dx)*(1-dy)+image[y0,x0+1]*dx*(1-dy)+image[y0+1,x0]*(1-dx)*dy+image[y0+1,x0+1]*dx*dy
    return np.where(good,result,0)

def real_cube():
    with ThreadPoolExecutor(2) as pool:
        jobs=[pool.submit(download,SOURCE,RAW/'DDO154_NA_CUBE_THINGS.FITS'),pool.submit(download,OPTICAL,RAW/'DDO154_Legacy_DR9_grz.fits')]
        paths=[job.result() for job in jobs]
    with fits.open(paths[0],memmap=True) as hdus:
        original=hdus[0].header.copy()
        data=hdus[0].data[0]
        nv,ny,nx=data.shape; factor=8
        assert nx%factor==0 and ny%factor==0
        # Preserve mean Jy/beam, negative voxels and missing coverage. Do not turn negatives into emission.
        grouped=np.asarray(data,dtype='float32').reshape(nv,ny//factor,factor,nx//factor,factor)
        finite=np.isfinite(grouped)
        count=finite.sum(axis=(2,4)); total=np.where(finite,grouped,0).sum(axis=(2,4))
        cube=np.divide(total,count,out=np.full(total.shape,np.nan),where=count>0).astype('float32')
        w=WCS(original).sub([1,2,3]); reduced=w.slice((slice(None),slice(None,None,factor),slice(None,None,factor)))
        velocities=np.asarray(w.spectral.pixel_to_world_values(np.arange(nv)))/1000
        header=reduced.to_header(relax=True)
        header['OBJECT']='DDO154';header['HISTORY']='THINGS natural-weighting cube; spatial block mean 8x8; source at project metadata.'
        rest=original.get('RESTFREQ',original.get('RESTFRQ',1.42040575e9));header['RESTFRQ']=rest
        history=' '.join(str(original.get('HISTORY','')).splitlines())
        major=re.search(r'BMAJ\s*=\s*([\d.Ee+\-]+)',history)
        minor=re.search(r'BMIN\s*=\s*([\d.Ee+\-]+)',history)
        bmaj=float(major.group(1))*3600 if major else None
        bmin=float(minor.group(1))*3600 if minor else None
        if bmaj: header['BMAJ']=bmaj/3600
        if bmin: header['BMIN']=bmin/3600
        yy,xx=np.mgrid[:cube.shape[1],:cube.shape[2]]
        ra,dec=reduced.celestial.pixel_to_world_values(xx,yy)
    with fits.open(paths[1]) as optical_hdus:
        optical_data=optical_hdus[0].data
        optical_wcs=WCS(optical_hdus[0].header).celestial
        sx,sy=optical_wcs.world_to_pixel_values(ra,dec)
        aligned=[bilinear(np.nan_to_num(b),sx,sy) for b in optical_data]
        # RGB is z,r,g; asinh display only. FITS preserves the original photometric bands.
        rgb=make_lupton_rgb(aligned[2],aligned[1],aligned[0],stretch=.06,Q=8)
    # A small positive-emission mask locates the systemic velocity for display, not a fitted science result.
    per_channel=np.nansum(np.where(cube>3*robust_sigma(cube[:5]),cube,0),axis=(1,2))
    vsys=float(np.sum(per_channel*velocities)/max(per_channel.sum(),1e-15))
    meta={
        'id':'ddo154','title':'DDO 154 · 真实观测','kind':'observation',
        'description':'THINGS / VLA 中性原子氢 cube，与 Legacy Surveys 光学图按 WCS 对齐。',
        'unit':'Jy/beam','velocities':velocities.tolist(),'vsys':vsys,
        'velocityConvention':'原头 FELO-HEL / VELREF=2；Astropy WCS 转换的日心光学速度',
        'pixelScaleArcsec':abs(float(original['CDELT2']))*3600*factor,
        'fieldArcmin':nx*abs(float(original['CDELT2']))*60,
        'beamMajorArcsec':bmaj,'beamMinorArcsec':bmin,
        'sources':[
          {'title':'THINGS / Walter et al. 2008, AJ 136, 2563','url':SOURCE,'credit':'VLA THINGS natural weighting; DDO154_NA_CUBE_THINGS.FITS'},
          {'title':'DESI Legacy Imaging Surveys DR9','url':OPTICAL,'credit':'Legacy Surveys grz FITS cutout; data use acknowledgment pending public release'},
        ],
        'processing':['原始 1024x1024x57，自然加权 Jy/beam','8x8 空间块均值，保留原谱轴、负值与无覆盖 NaN','WCS 处理 FELO-HEL，浏览器按速度升序排列','光学 grz 按天球 WCS 双线性重投影；z/r/g RGB asinh 显示','原始 FITS 缓存在 data/raw/；浏览器只使用精简派生数据','显示中心速度由正发射加权估计，不作为正式拟合结果','空间平均额外平滑；原波束值不等于精简图的完整有效 PSF'],
    }
    return write_dataset(meta,cube,rgb,header)

def main():
    parser=argparse.ArgumentParser(description='Generate simulated HI cubes; real reference downloads are opt-in.')
    parser.add_argument('--with-reference',action='store_true',help='also download and process the optional THINGS / Legacy reference')
    parser.add_argument('--synthetic-only',action='store_true',help='legacy alias for the default simulation-only mode')
    args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    catalog=[synthetic(False),synthetic(True)]
    if args.with_reference and not args.synthetic_only:
        try: catalog.append(real_cube())
        except Exception as e:
            print('REAL DATA NOT READY:',repr(e),flush=True)
            (OUT/'real-data-error.txt').write_text(repr(e),encoding='utf-8')
    (OUT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Catalog:',[x['id'] for x in catalog],flush=True)

if __name__=='__main__':main()
