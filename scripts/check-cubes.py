#!/usr/bin/env python3
"""Numerical acceptance checks for generated observational-model cubes."""
from pathlib import Path
import gzip,hashlib,json
import numpy as np
from astropy.io import fits
from astropy.wcs import WCS

root=Path(__file__).resolve().parents[1]/'public/cubes'
for dataset in ['sim-disk','sim-disturbed']:
    p=root/dataset;m=json.loads((p/'metadata.json').read_text())
    raw=gzip.decompress((p/'cube.f32.gz').read_bytes())
    data=np.frombuffer(raw,dtype='<f4').reshape(m['shape'])
    with fits.open(p/'cube.fits',checksum=True) as hdus:
        hdus.verify('exception');h=hdus[0].header
        np.testing.assert_array_equal(data,hdus[0].data[:,::-1,:])
        velocities=WCS(h).spectral.pixel_to_world_values(np.arange(data.shape[0]))/1000
        np.testing.assert_allclose(velocities,m['velocities'])
        assert h['BUNIT']=='Jy/beam'
        assert abs(h['BMAJ']*3600-16)<1e-8
    clean=fits.getdata(p/'noiseless-model.fits')[:,::-1,:]
    browser_clean=np.frombuffer(gzip.decompress((p/m['noiselessFile']).read_bytes()),dtype='<f4').reshape(m['shape'])
    np.testing.assert_array_equal(browser_clean,clean)
    assert data.shape==(101,128,128) and np.all(np.isfinite(data))
    assert np.min(data)<0 and np.min(clean)>=0
    noise=data-clean
    rms=1.4826*np.median(np.abs(noise-np.median(noise)))
    assert abs(rms/.00011-1)<.03,(dataset,rms)
    spatial=np.corrcoef(noise[:,:,:-1].ravel(),noise[:,:,1:].ravel())[0,1]
    spectral=np.corrcoef(noise[:-1].ravel(),noise[1:].ravel())[0,1]
    assert spatial>.6 and spectral>.1,(spatial,spectral)
    assert hashlib.sha256(raw).hexdigest()==m['processedSha256']
    if dataset=='sim-disk':
        total=clean.sum(axis=(1,2))
        centroid=float(np.dot(total,m['velocities'])/total.sum())
        assert abs(centroid)<.1,centroid
    print('PASS',dataset,'shape',data.shape,'RMS',f'{rms:.7f}','spatial correlation',f'{spatial:.3f}','spectral correlation',f'{spectral:.3f}')
print('PASS FITS / binary equality, WCS spectral axis, beam and units, signed noise, correlations, payload hash, symmetric-disk systemic velocity.')
