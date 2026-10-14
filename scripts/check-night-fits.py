#!/usr/bin/env python3
"""Verify a browser-downloaded teaching observation against its FITS provenance."""
from pathlib import Path
import argparse
import numpy as np
from astropy.io import fits
from astropy.wcs import WCS

parser=argparse.ArgumentParser()
parser.add_argument('path',type=Path)
args=parser.parse_args()
with fits.open(args.path) as hdus:
    hdus.verify('exception')
    actual=hdus[0].data.copy();h=hdus[0].header.copy()
source=h.get('SRCID','sim-disturbed')
assert source in ['sim-disk','sim-disturbed'],source
root=Path(__file__).resolve().parents[1]/'public/cubes'/source
base=fits.getdata(root/'cube.fits')[:,::-1,:].astype(np.float64)
clean=fits.getdata(root/'noiseless-model.fits')[:,::-1,:].astype(np.float64)
nv,ny,nx=base.shape;y,x=np.mgrid[:ny,:nx];run=int(h['OBSRUN'])
east=-(x-(nx-1)/2)*4/60; north=((ny-1)/2-y)*4/60
moving=int(h.get('OBSVER',1))==2
field_east=h['POINTE'] if moving else 0;field_north=h['POINTN'] if moving else 0
pb=np.exp(-4*np.log(2)*((east+field_east-h['POINTE'])**2+(north+field_north-h['POINTN'])**2)/14**2).astype(np.float32)
if moving:
    sx=x-field_east*60/4;sy=y-field_north*60/4
    x0=np.floor(sx).astype(int);y0=np.floor(sy).astype(int);fx=sx-x0;fy=sy-y0
    projected=np.zeros_like(clean)
    for dx,dy,weight in [(0,0,(1-fx)*(1-fy)),(1,0,fx*(1-fy)),(0,1,(1-fx)*fy),(1,1,fx*fy)]:
        xx=x0+dx;yy=y0+dy;valid=(xx>=0)&(xx<nx)&(yy>=0)&(yy<ny)
        projected[:,valid]+=clean[:,yy[valid],xx[valid]]*weight[valid]
else:projected=clean
noise=np.roll(base-clean,(-run*19%nv,-run*23%ny,-run*17%nx),axis=(0,1,2))*np.sqrt(960/h['EXPTIME'])
expected=projected*pb+noise;v=np.arange(nv)*5-250
for k,velocity in enumerate(v):
    covered=abs(1420.40575*(1-velocity/299792.458)*1e6-h['OBSFREQ'])<=h['TOTBAND']/2
    rfi=abs(velocity-35)<=5
    if not covered or (rfi and h['RFIREF'] and h['RFIFLAG']):expected[k]=np.nan
    elif rfi:expected[k]+=.007*np.exp(-.5*((velocity-35)/4)**2)
expected=expected[:,::-1,:].astype(np.float32)
np.testing.assert_array_equal(actual,expected)
assert actual.shape==(101,128,128) and h['BUNIT']=='Jy/beam' and h['SIMULATE'] and not h['PBCOR']
world=WCS(h).all_pix2world([[0,0,0],[nx-1,ny-1,nv-1]],0)
np.testing.assert_allclose(world[:,2],[-250000,250000])
np.testing.assert_allclose([h['CRVAL1'],h['CRVAL2']],[field_east*60,field_north*60])
assert abs(h['BMAJ']*3600-16)<1e-9
print('PASS browser FITS / independent observation model: exact voxel equality including NaNs; WCS, Jy/beam, 16-arcsec beam, provenance, exposure and primary-beam convention.')
